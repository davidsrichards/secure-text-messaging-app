import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import axios from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { API_BASE_URL } from '../config/api';
import { errorMessage, useAuth } from '../context/AuthContext';
import { RootStackParamList, UserProfile } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Contacts'>;

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
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Signed in as {user?.username}</Text>
        <TouchableOpacity onPress={() => logout()}>
          <Text style={styles.logout}>Logout</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item._id}
          refreshing={loading}
          onRefresh={load}
          ListEmptyComponent={<Text style={styles.empty}>No other users registered yet.</Text>}
          renderItem={({ item }) => {
            const online = onlineUsers.includes(item._id);
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() =>
                  navigation.navigate('Chat', {
                    peerId: item._id,
                    peerUsername: item.username,
                    peerPublicKey: item.publicKey,
                  })
                }
              >
                <View style={[styles.dot, { backgroundColor: online ? '#2ecc71' : '#9aa0a6' }]} />
                <Text style={styles.name}>{item.username}</Text>
                <Text style={styles.status}>{online ? 'online' : 'offline'}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  badge: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, backgroundColor: '#eef2ff' },
  badgeText: { fontWeight: '600', color: '#1b2a49' },
  logout: { color: '#d93025', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  name: { flex: 1, fontSize: 16 },
  status: { color: '#777' },
  empty: { textAlign: 'center', marginTop: 40, color: '#777' },
});
