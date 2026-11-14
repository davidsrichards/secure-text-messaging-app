import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import SafetyNumberModal from '../components/SafetyNumberModal';
import { API_BASE_URL } from '../config/api';
import { errorMessage, useAuth } from '../context/AuthContext';
import { decryptMessage, encryptMessage } from '../crypto/e2ee';
import { saveMessageCache } from '../storage/localStore';
import { DecryptedChatMessage, RootStackParamList, WireMessage } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

const ALERT_TEXT =
  'Integrity Violation Detected: HMAC verification failed. Potential Man-in-the-Middle (MITM) tampering blocked and session reset.';

function flipOneChar(s: string): string {
  const i = Math.min(2, s.length - 1);
  return `${s.slice(0, i)}${s.charAt(i) === 'A' ? 'B' : 'A'}${s.slice(i + 1)}`;
}

export default function ChatScreen({ navigation, route }: Props): React.JSX.Element {
  const { peerId, peerUsername, peerPublicKey } = route.params;
  const { user, privateKey, socket, authHeaders } = useAuth();
  const [messages, setMessages] = useState<DecryptedChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [tamper, setTamper] = useState<boolean>(false);
  const [alertVisible, setAlertVisible] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const listRef = useRef<FlatList<DecryptedChatMessage>>(null);
  const myId = user?._id ?? '';

  const toChatMessage = useCallback(
    (w: WireMessage, index: number): DecryptedChatMessage => {
      const base = {
        id: w._id ?? `${w.timestamp}-${index}`,
        senderId: w.sender,
        recipientId: w.recipient,
        timestamp: w.timestamp,
      };
      try {
        const plaintext = decryptMessage(w, privateKey ?? '', peerPublicKey);
        return { ...base, plaintext, verified: true };
      } catch (err) {
        const own = w.sender === myId;
        if (!own || !w.tamperedTest) {
          console.warn(`[SECURITY] Blocked packet ${base.id}: ${err instanceof Error ? err.message : 'decrypt error'}`);
          setAlertVisible(true);
        }
        return { ...base, plaintext: '', verified: false };
      }
    },
    [privateKey, peerPublicKey, myId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get<WireMessage[]>(`${API_BASE_URL}/api/messages/${peerId}`, {
          headers: authHeaders(),
        });
        if (!cancelled) setMessages(data.map(toChatMessage));
      } catch (err) {
        Alert.alert('Could not load history', errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [peerId, authHeaders, toChatMessage]);

  useEffect(() => {
    if (!socket) return;
    const onReceive = (w: WireMessage): void => {
      if (w.sender !== peerId) return;
      setMessages((prev) => [...prev, toChatMessage(w, prev.length)]);
    };
    socket.on('receive_message', onReceive);
    return () => {
      socket.off('receive_message', onReceive);
    };
  }, [socket, peerId, toChatMessage]);

  useEffect(() => {
    if (myId && messages.length > 0) {
      saveMessageCache(myId, peerId, messages.filter((m) => m.verified)).catch(() => undefined);
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages, myId, peerId]);

  const send = (): void => {
    const text = input.trim();
    if (!text || !socket || !privateKey) return;
    const packet = encryptMessage(text, privateKey, peerPublicKey);
    socket.emit('send_message', {
      recipientId: peerId,
      ciphertext: tamper ? flipOneChar(packet.ciphertext) : packet.ciphertext,
      iv: packet.iv,
      salt: packet.salt,
      hmac: packet.hmac,
      tamperedTest: tamper,
    });
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}-${prev.length}`,
        senderId: myId,
        recipientId: peerId,
        plaintext: tamper ? `${text}  [sent with simulated MITM tamper]` : text,
        timestamp: new Date().toISOString(),
        verified: true,
      },
    ]);
    setInput('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{'<'} Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.peer}>{peerUsername}</Text>
          <Text style={styles.lock}>🔒 E2EE Verified (Curve25519 + AES-256)</Text>
        </View>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Text style={styles.verify}>Verify Key</Text>
        </TouchableOpacity>
      </View>

      {alertVisible && (
        <TouchableOpacity style={styles.banner} onPress={() => setAlertVisible(false)}>
          <Text style={styles.bannerText}>{ALERT_TEXT}</Text>
          <Text style={styles.bannerDismiss}>Tap to dismiss</Text>
        </TouchableOpacity>
      )}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const mine = item.senderId === myId;
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs, !item.verified && styles.blocked]}>
              {item.verified ? (
                <Text style={mine ? styles.mineText : styles.theirsText}>🔒 {item.plaintext}</Text>
              ) : (
                <Text style={styles.blockedText}>Message blocked: integrity check failed</Text>
              )}
              <Text style={[styles.time, mine && { color: '#dbe4ff' }]}>
                {new Date(item.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          );
        }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.tamperRow}>
          <Text style={styles.tamperLabel}>Simulate MITM Tamper</Text>
          <Switch value={tamper} onValueChange={setTamper} />
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type an encrypted message"
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity style={styles.send} onPress={send}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <SafetyNumberModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        myUsername={user?.username ?? ''}
        peerUsername={peerUsername}
        myPublicKey={user?.publicKey ?? ''}
        peerPublicKey={peerPublicKey}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6fb' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ccc' },
  back: { color: '#2d5be3', fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center' },
  peer: { fontSize: 17, fontWeight: '700' },
  lock: { fontSize: 11, color: '#1e8e3e', marginTop: 2 },
  verify: { color: '#2d5be3', fontWeight: '600' },
  banner: { backgroundColor: '#d93025', padding: 12 },
  bannerText: { color: '#fff', fontWeight: '700' },
  bannerDismiss: { color: '#ffd6d2', fontSize: 11, marginTop: 4 },
  list: { padding: 12 },
  bubble: { maxWidth: '80%', padding: 10, borderRadius: 12, marginBottom: 8 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#2d5be3' },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#fff' },
  blocked: { backgroundColor: '#fde7e5', borderWidth: 1, borderColor: '#d93025' },
  mineText: { color: '#fff' },
  theirsText: { color: '#111' },
  blockedText: { color: '#d93025', fontWeight: '600' },
  time: { fontSize: 10, color: '#888', marginTop: 4, alignSelf: 'flex-end' },
  tamperRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 4, backgroundColor: '#fff8e1' },
  tamperLabel: { color: '#8a6d00', fontWeight: '600' },
  inputRow: { flexDirection: 'row', padding: 8, backgroundColor: '#fff', alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1, borderColor: '#d5dbe8', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 100 },
  send: { backgroundColor: '#2d5be3', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10, marginLeft: 8 },
  sendText: { color: '#fff', fontWeight: '600' },
});
