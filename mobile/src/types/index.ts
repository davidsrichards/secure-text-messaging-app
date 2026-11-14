export interface IdentityKeyPair {
  publicKey: string; // Base64-encoded 32-byte Curve25519 public key
  privateKey: string; // Base64-encoded 32-byte Curve25519 private key
}

export interface EncryptedPacket {
  ciphertext: string; // Base64 AES-256-CBC ciphertext
  iv: string; // Base64 16-byte Initialization Vector
  salt: string; // Base64 16-byte HKDF salt
  hmac: string; // Base64 32-byte HMAC-SHA256 tag
}

export interface WireMessage extends EncryptedPacket {
  _id?: string;
  sender: string;
  recipient: string;
  tamperedTest?: boolean;
  timestamp: string;
}

export interface DecryptedChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  plaintext: string;
  timestamp: string;
  verified: boolean;
}

export interface UserProfile {
  _id: string;
  username: string;
  publicKey: string;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface SendMessagePayload extends EncryptedPacket {
  recipientId: string;
  tamperedTest: boolean;
}

export interface ClientToServerEvents {
  send_message: (payload: SendMessagePayload) => void;
}

export interface ServerToClientEvents {
  receive_message: (message: WireMessage) => void;
  message_sent: (message: WireMessage) => void;
  online_users: (userIds: string[]) => void;
}

export interface StoredSession {
  token: string;
  user: UserProfile;
}

export type RootStackParamList = {
  Auth: undefined;
  Contacts: undefined;
  Chat: {
    peerId: string;
    peerUsername: string;
    peerPublicKey: string;
  };
};
