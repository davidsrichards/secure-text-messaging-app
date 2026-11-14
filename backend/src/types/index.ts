export interface EncryptedPacket {
  ciphertext: string;
  iv: string;
  salt: string;
  hmac: string;
}

export interface WireMessage extends EncryptedPacket {
  _id: string;
  sender: string;
  recipient: string;
  tamperedTest: boolean;
  timestamp: string;
}

export interface SendMessagePayload extends EncryptedPacket {
  recipientId: string;
  tamperedTest: boolean;
}

export interface PublicUser {
  _id: string;
  username: string;
  publicKey: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface AuthPayload {
  id: string;
  username: string;
}

export interface ClientToServerEvents {
  send_message: (payload: SendMessagePayload) => void;
}

export interface ServerToClientEvents {
  receive_message: (message: WireMessage) => void;
  message_sent: (message: WireMessage) => void;
  online_users: (userIds: string[]) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  user: AuthPayload;
}
