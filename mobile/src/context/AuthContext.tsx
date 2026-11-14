import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';
import { derivePublicKey, generateIdentityKeyPair } from '../crypto/e2ee';
import {
  clearSession,
  loadPrivateKey,
  loadSession,
  savePrivateKey,
  saveSession,
} from '../storage/localStore';
import {
  AuthResponse,
  ClientToServerEvents,
  ServerToClientEvents,
  StoredSession,
  UserProfile,
} from '../types';

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export class MissingKeyError extends Error {
  constructor() {
    super('No private key found on this device for this account.');
    this.name = 'MissingKeyError';
  }
}

interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  privateKey: string | null;
  socket: ChatSocket | null;
  onlineUsers: string[];
  loading: boolean;
  register: (username: string, password: string) => Promise<void>;
  login: (username: string, password: string, regenerateKey?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  authHeaders: () => { Authorization: string };
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data: unknown = err.response?.data;
    if (typeof data === 'object' && data !== null && 'error' in data) {
      return String((data as { error: unknown }).error);
    }
    return err.message;
  }
  return err instanceof Error ? err.message : 'Unknown error';
}

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [socket, setSocket] = useState<ChatSocket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const tokenRef = useRef<string | null>(null);

  const activate = useCallback(async (session: StoredSession, key: string): Promise<void> => {
    tokenRef.current = session.token;
    await saveSession(session);
    setPrivateKey(key);
    setUser(session.user);
    setToken(session.token);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const session = await loadSession();
        if (session) {
          const key = await loadPrivateKey(session.user.username);
          if (key && derivePublicKey(key) === session.user.publicKey) await activate(session, key);
          else await clearSession();
        }
      } catch {
        await clearSession();
      } finally {
        setLoading(false);
      }
    })();
  }, [activate]);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      setOnlineUsers([]);
      return;
    }
    const s: ChatSocket = io(API_BASE_URL, { auth: { token }, transports: ['websocket'] });
    s.on('online_users', setOnlineUsers);
    setSocket(s);
    return () => {
      s.off('online_users', setOnlineUsers);
      s.disconnect();
    };
  }, [token]);

  const register = useCallback(
    async (username: string, password: string): Promise<void> => {
      const keys = generateIdentityKeyPair();
      const { data } = await axios.post<AuthResponse>(`${API_BASE_URL}/api/auth/register`, {
        username,
        password,
        publicKey: keys.publicKey,
      });
      await savePrivateKey(data.user.username, keys.privateKey);
      await activate({ token: data.token, user: data.user }, keys.privateKey);
    },
    [activate],
  );

  const login = useCallback(
    async (username: string, password: string, regenerateKey = false): Promise<void> => {
      const { data } = await axios.post<AuthResponse>(`${API_BASE_URL}/api/auth/login`, { username, password });
      let key = await loadPrivateKey(data.user.username);
      let profile = data.user;
      if (!key || derivePublicKey(key) !== data.user.publicKey) {
        if (!regenerateKey) throw new MissingKeyError();
        const keys = generateIdentityKeyPair();
        const res = await axios.put<UserProfile>(
          `${API_BASE_URL}/api/users/key`,
          { publicKey: keys.publicKey },
          { headers: { Authorization: `Bearer ${data.token}` } },
        );
        await savePrivateKey(data.user.username, keys.privateKey);
        key = keys.privateKey;
        profile = res.data;
      }
      await activate({ token: data.token, user: profile }, key);
    },
    [activate],
  );

  const logout = useCallback(async (): Promise<void> => {
    tokenRef.current = null;
    await clearSession();
    setToken(null);
    setUser(null);
    setPrivateKey(null);
  }, []);

  const authHeaders = useCallback(
    (): { Authorization: string } => ({ Authorization: `Bearer ${tokenRef.current ?? ''}` }),
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, privateKey, socket, onlineUsers, loading, register, login, logout, authHeaders }),
    [user, token, privateKey, socket, onlineUsers, loading, register, login, logout, authHeaders],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
