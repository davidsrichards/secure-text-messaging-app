import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Avatar from '../components/Avatar';
import { API_BASE_URL } from '../config/api';
import { errorMessage, useAuth } from '../context/AuthContext';
import { cardShadow, colors, mono } from '../theme/colors';
import { RootStackParamList, UserProfile } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Contacts'>;

const keyPreview = (key: string): string => (key.length > 10 ? `${key.slice(0, 4)}...${key.slice(-4)}` : key);

export default function ContactsScreen({ navigation }: Props): React.JSX.Element {
  const { user, onlineUsers, authHeaders, logout } = useAuth();
  const [contacts, setContacts] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const load = useCallback(async (): Promise<void> => {
    try {
      const { data } = await axios.get<UserProfile[]>(`${API_BASE_URL}/api/users`, { headers: authHeaders() });
      setContacts(data);
    } catch (err) {
      Alert.alert('Could not load contacts', errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <Avatar name={user?.username ?? '?'} size={42} ringColor={colors.dark} />
          <View style={styles.headerText}>
            <Text style={styles.username} numberOfLines={1}>
              {user?.username}
            </Text>
            <View style={styles.pill}>
              <Ionicons name="shield-checkmark" size={11} color={colors.verified} />
              <Text style={styles.pillText}>E2EE Active</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.logout} onPress={() => logout()} hitSlop={8}>
            <Ionicons name="log-out-outline" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item._id}
          refreshing={loading}
          onRefresh={load}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="people-outline" size={40} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No contacts yet</Text>
              <Text style={styles.empty}>No other users registered yet. Invite someone to create an account and start an encrypted chat.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const online = onlineUsers.includes(item._id);
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.8}
                onPress={() =>
                  navigation.navigate('Chat', {
                    peerId: item._id,
                    peerUsername: item.username,
                    peerPublicKey: item.publicKey,
                  })
                }
              >
                <Avatar name={item.username} size={48} online={online} />
                <View style={styles.cardText}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.username}
                  </Text>
                  <Text style={styles.key}>Key: {keyPreview(item.publicKey)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.dark },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  headerText: { flex: 1, marginLeft: 12 },
  username: { color: colors.white, fontSize: 18, fontWeight: '700' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
    gap: 4,
  },
  pillText: { color: colors.verified, fontSize: 11, fontWeight: '700' },
  logout: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  loader: { marginTop: 40 },
  list: { padding: 16, flexGrow: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  cardText: { flex: 1, marginHorizontal: 14 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  key: { fontFamily: mono, fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  empty: { textAlign: 'center', marginTop: 6, color: colors.textSecondary, lineHeight: 20 },
});
