import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Avatar from '../components/Avatar';
import SafetyNumberModal from '../components/SafetyNumberModal';
import { API_BASE_URL } from '../config/api';
import { errorMessage, useAuth } from '../context/AuthContext';
import { decryptMessage, encryptMessage } from '../crypto/e2ee';
import { saveMessageCache } from '../storage/localStore';
import { cardShadow, colors } from '../theme/colors';
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
  const { user, privateKey, socket, authHeaders, onlineUsers } = useAuth();
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

  const online = onlineUsers.includes(peerId);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={colors.white} />
        </TouchableOpacity>
        <Avatar name={peerUsername} size={40} online={online} ringColor={colors.dark} />
        <View style={styles.headerCenter}>
          <Text style={styles.peer} numberOfLines={1}>
            {peerUsername}
          </Text>
          <View style={styles.pill}>
            <Ionicons name="shield-checkmark" size={10} color={colors.verified} />
            <Text style={styles.pillText}>Curve25519 • AES-256</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.verify} onPress={() => setModalVisible(true)} activeOpacity={0.8}>
          <Ionicons name="shield-checkmark-outline" size={15} color={colors.white} />
          <Text style={styles.verifyText}>Verify Key</Text>
        </TouchableOpacity>
      </View>

      {alertVisible && (
        <View style={styles.alertCard}>
          <Ionicons name="warning" size={24} color={colors.danger} />
          <View style={styles.alertBody}>
            <Text style={styles.alertTitle}>Integrity Violation Blocked</Text>
            <Text style={styles.alertText}>{ALERT_TEXT}</Text>
          </View>
          <TouchableOpacity onPress={() => setAlertVisible(false)} hitSlop={8}>
            <Ionicons name="close-circle" size={24} color={colors.danger} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const mine = item.senderId === myId;
          const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          if (!item.verified) {
            return (
              <View style={[styles.bubble, styles.blocked, mine ? styles.mine : styles.theirs]}>
                <View style={styles.blockedRow}>
                  <Ionicons name="shield-outline" size={18} color={colors.danger} />
                  <Text style={styles.blockedText}>Message blocked: integrity check failed</Text>
                </View>
                <View style={styles.meta}>
                  <Text style={[styles.time, { color: colors.danger }]}>{time}</Text>
                </View>
              </View>
            );
          }
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text style={mine ? styles.mineText : styles.theirsText}>{item.plaintext}</Text>
              <View style={styles.meta}>
                <Ionicons name="lock-closed" size={9} color={mine ? 'rgba(255,255,255,0.75)' : colors.textMuted} />
                <Text style={[styles.time, mine && styles.timeMine]}>{time}</Text>
              </View>
            </View>
          );
        }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.tamperWrap}>
          <TouchableOpacity
            style={[styles.tamperPill, tamper && styles.tamperPillOn]}
            onPress={() => setTamper((v) => !v)}
            activeOpacity={0.8}
          >
            <Ionicons name="flask-outline" size={15} color={tamper ? colors.warningText : colors.textSecondary} />
            <Text style={[styles.tamperLabel, tamper && styles.tamperLabelOn]}>Simulate MITM Tamper</Text>
            <View style={[styles.tamperBadge, tamper && styles.tamperBadgeOn]}>
              <Text style={[styles.tamperBadgeText, tamper && { color: colors.warningText }]}>{tamper ? 'ON' : 'OFF'}</Text>
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type an encrypted message"
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity style={[styles.send, !input.trim() && styles.sendDisabled]} onPress={send} activeOpacity={0.85}>
            <Ionicons name="send" size={18} color={colors.white} />
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
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, backgroundColor: colors.dark },
  back: { paddingRight: 4 },
  headerCenter: { flex: 1, marginLeft: 10 },
  peer: { fontSize: 16, fontWeight: '700', color: colors.white },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 3,
    gap: 3,
  },
  pillText: { color: colors.verified, fontSize: 10, fontWeight: '700' },
  verify: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.verified,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    gap: 4,
  },
  verifyText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 12,
    marginTop: 10,
    gap: 10,
    ...cardShadow,
  },
  alertBody: { flex: 1 },
  alertTitle: { color: colors.danger, fontWeight: '800', fontSize: 15 },
  alertText: { color: colors.text, fontSize: 12, marginTop: 3, lineHeight: 17 },
  list: { padding: 12 },
  bubble: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, marginBottom: 8 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4, ...cardShadow },
  blocked: { backgroundColor: colors.dangerBg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.danger, elevation: 0, shadowOpacity: 0 },
  blockedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  blockedText: { color: colors.danger, fontWeight: '600', flexShrink: 1 },
  mineText: { color: colors.white, fontSize: 15 },
  theirsText: { color: colors.text, fontSize: 15 },
  meta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 3, gap: 3 },
  time: { fontSize: 10, color: colors.textMuted },
  timeMine: { color: 'rgba(255,255,255,0.75)' },
  tamperWrap: { paddingHorizontal: 12, paddingTop: 6, backgroundColor: colors.background },
  tamperPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.subtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 5,
    paddingLeft: 10,
    paddingRight: 6,
    gap: 6,
  },
  tamperPillOn: { backgroundColor: colors.warningBg, borderColor: colors.warning },
  tamperLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  tamperLabelOn: { color: colors.warningText },
  tamperBadge: { backgroundColor: colors.border, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  tamperBadgeOn: { backgroundColor: '#FDE68A' },
  tamperBadgeText: { fontSize: 10, fontWeight: '800', color: colors.textSecondary },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, backgroundColor: colors.background, gap: 8 },
  input: {
    flex: 1,
    backgroundColor: colors.subtle,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 110,
    fontSize: 15,
    color: colors.text,
  },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.5 },
});
