import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DecryptedChatMessage, StoredSession } from '../types';

const SESSION_KEY = 'e2ee_session';

const privateKeyName = (username: string): string => `e2ee_private_key_${username.toLowerCase()}`;
const cacheKey = (userId: string, peerId: string): string => `e2ee_cache_${userId}_${peerId}`;

export async function savePrivateKey(username: string, privateKeyB64: string): Promise<void> {
  await SecureStore.setItemAsync(privateKeyName(username), privateKeyB64);
}

export async function loadPrivateKey(username: string): Promise<string | null> {
  return SecureStore.getItemAsync(privateKeyName(username));
}

export async function saveSession(session: StoredSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<StoredSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as StoredSession) : null;
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function saveMessageCache(
  userId: string,
  peerId: string,
  messages: DecryptedChatMessage[],
): Promise<void> {
  await AsyncStorage.setItem(cacheKey(userId, peerId), JSON.stringify(messages));
}

export async function loadMessageCache(userId: string, peerId: string): Promise<DecryptedChatMessage[]> {
  const raw = await AsyncStorage.getItem(cacheKey(userId, peerId));
  return raw ? (JSON.parse(raw) as DecryptedChatMessage[]) : [];
}
