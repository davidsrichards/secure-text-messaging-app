# Project Architecture Specification: Secure Text Messaging Application with End-to-End Encryption (E2EE) — TypeScript Edition

## 1. Project Overview & Academic Alignment

This application implements a mobile-first **Secure Text Messaging System with End-to-End Encryption (E2EE)** designed for an undergraduate Computer Science final-year project, built end-to-end in **TypeScript**.

The system enforces a **Zero-Knowledge Server Architecture**: plaintext messages and private cryptographic keys never leave the user's mobile device. The backend acts strictly as an authentication provider, public-key directory, and encrypted packet relay.

### Three-Layer Modular Architecture

1. **User Application Layer (Mobile Client - TypeScript / TSX):** Handles registration, login, contact selection, key-fingerprint verification, plaintext message input, local chat history display, and security alerts.
2. **Key Management Layer (Mobile Client - TypeScript):** Generates and stores long-term `Curve25519` (`X25519`) key pairs on-device, performs Elliptic Curve Diffie-Hellman (ECDH) key agreement, derives unique per-message session keys via `HKDF-SHA256` (providing Forward Secrecy properties), and computes SHA-256 Safety Numbers.
3. **Transmission Protocol Layer (Mobile Client + Node/Socket.IO Relay - TypeScript):** Encrypts outgoing messages using `AES-256-CBC`, authenticates every packet using `HMAC-SHA256` (Encrypt-then-MAC), routes opaque ciphertext packets via WebSockets, and terminates/rejects tampered packets upon HMAC mismatch.

---

## 2. Repository Structure

Create a clean two-folder TypeScript workspace in the root directory:

```text
secure-e2ee-messaging/
├── ARCHITECTURE.md
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── config/
│       │   └── db.ts
│       ├── middleware/
│       │   └── authMiddleware.ts
│       ├── models/
│       │   ├── User.ts
│       │   └── Message.ts
│       ├── routes/
│       │   ├── authRoutes.ts
│       │   └── userRoutes.ts
│       ├── socket/
│       │   └── chatSocket.ts
│       ├── types/
│       │   └── index.ts
│       └── server.ts
└── mobile/
    ├── App.tsx
    ├── app.json
    ├── index.ts
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── config/
        │   └── api.ts
        ├── crypto/
        │   └── e2ee.ts
        ├── storage/
        │   └── localStore.ts
        ├── types/
        │   └── index.ts
        ├── context/
        │   └── AuthContext.tsx
        ├── screens/
        │   ├── AuthScreen.tsx
        │   ├── ContactsScreen.tsx
        │   └── ChatScreen.tsx
        └── components/
            └── SafetyNumberModal.tsx
```

---

## 3. Tech Stack & Exact Dependencies (Free Tier)

### 3.1 Backend (`/backend`)
- **Language & Runtime:** TypeScript (`typescript`, `tsx` for dev execution) on Node.js + Express
- **Real-Time Transport:** `socket.io` (with strongly typed `ClientToServerEvents` and `ServerToClientEvents`)
- **Database:** MongoDB Atlas (Free M0 Cluster) via `mongoose`
- **Authentication & Security:** `bcryptjs`, `jsonwebtoken`, `cors`, `dotenv`
- **Type Definitions (`devDependencies`):** `@types/node`, `@types/express`, `@types/bcryptjs`, `@types/jsonwebtoken`, `@types/cors`
- **`backend/tsconfig.json`:** Configure `"target": "ES2022"`, `"module": "CommonJS"`, `"moduleResolution": "node"`, `"esModuleInterop": true`, `"strict": true`, `"outDir": "./dist"`, `"rootDir": "./src"`.

### 3.2 Mobile App (`/mobile`)
- **Framework:** React Native with **Expo** and **TypeScript** (`expo`, `typescript`, `@types/react`)
- **Navigation:** `@react-navigation/native`, `@react-navigation/native-stack`, `react-native-screens`, `react-native-safe-area-context` (with typed `RootStackParamList`)
- **Cryptography (Pure TS/JS, Audited, Expo Go Compatible):**
  - `react-native-get-random-values` (MUST be imported as line 1 of `mobile/index.ts`)
  - `@noble/curves` (for `X25519` / `Curve25519` key generation and ECDH shared secret)
  - `@noble/ciphers` (for `AES-256-CBC` encryption and decryption)
  - `@noble/hashes` (for `HMAC-SHA256`, `HKDF-SHA256`, and `SHA-256` fingerprints)
- **On-Device Storage:**
  - `expo-secure-store` (hardware-backed Keychain/Keystore for storing the user's `Curve25519` private key)
  - `@react-native-async-storage/async-storage` (local storage for user session token and decrypted message cache)
- **Networking:** `socket.io-client`, `axios`
- **`mobile/tsconfig.json`:** Extend `"expo/tsconfig.base"` with `"strict": true`.

---

## 4. Shared TypeScript Interfaces (`mobile/src/types/index.ts`)

Define explicit interfaces so cryptographic payloads, API responses, and navigation parameters are fully type-checked:

```typescript
export interface IdentityKeyPair {
  publicKey: string;  // Base64-encoded 32-byte Curve25519 public key
  privateKey: string; // Base64-encoded 32-byte Curve25519 private key
}

export interface EncryptedPacket {
  ciphertext: string; // Base64 AES-256-CBC ciphertext
  iv: string;         // Base64 16-byte Initialization Vector
  salt: string;       // Base64 16-byte HKDF salt
  hmac: string;       // Base64 32-byte HMAC-SHA256 tag
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

export type RootStackParamList = {
  Auth: undefined;
  Contacts: undefined;
  Chat: {
    peerId: string;
    peerUsername: string;
    peerPublicKey: string;
  };
};
```

---

## 5. Cryptographic Specification (`mobile/src/crypto/e2ee.ts`)

All cryptographic operations MUST execute exclusively inside `mobile/src/crypto/e2ee.ts` with explicit TypeScript parameter and return types. Do NOT perform message encryption, decryption, or private key generation on the backend.

### 5.1 Key Generation (`generateIdentityKeyPair(): IdentityKeyPair`)
- Generate a $32$-byte ($256$-bit) random private key using `x25519.utils.randomPrivateKey()`.
- Derive the corresponding $32$-byte public key using `x25519.getPublicKey(privateKey)`.
- Encode keys as Base64 strings (`Uint8Array` $\leftrightarrow$ Base64 helper functions written cleanly in TypeScript without relying on Node `Buffer`).
- Store `privateKey` immediately in `expo-secure-store` under key `e2ee_private_key_<username>`. Upload only `publicKey` to the backend.

### 5.2 Shared Secret & Dynamic Per-Message Key Derivation (`deriveMessageKeys`)
To satisfy Forward Secrecy and dynamic key ratcheting requirements:
1. Compute the base ECDH shared secret:
   $$\text{sharedSecret} = \text{X25519}(\text{senderPrivateKey}, \text{recipientPublicKey})$$
2. For **every individual message**, generate a fresh random $16$-byte `salt` and a fresh random $16$-byte `iv` (Initialization Vector).
3. Use `HKDF-SHA256` (`@noble/hashes/hkdf`) with `sharedSecret`, `salt`, and info string `"E2EE-MSG-KEY-v1"` to derive $64$ bytes of key material:
   - **Bytes $0\dots 31$ ($256$-bit):** `aesKey` (`Uint8Array`, for `AES-256-CBC`)
   - **Bytes $32\dots 63$ ($256$-bit):** `hmacKey` (`Uint8Array`, for `HMAC-SHA256`)

### 5.3 Encrypt-then-MAC Pipeline (`encryptMessage(plaintext: string, senderPrivateKeyB64: string, recipientPublicKeyB64: string): EncryptedPacket`)
1. Encode the UTF-8 plaintext string into `Uint8Array` using `TextEncoder`.
2. Encrypt using `AES-256-CBC` (`cbc(aesKey, iv).encrypt(plaintextBytes)`) to produce `ciphertextBytes`.
3. Construct the authenticated payload buffer:
   $$\text{authData} = \text{salt} \parallel \text{iv} \parallel \text{ciphertextBytes}$$
4. Compute the authentication tag using `HMAC-SHA256`:
   $$\text{hmacTag} = \text{HMAC-SHA256}(\text{hmacKey}, \text{authData})$$
5. Return `{ ciphertext, iv, salt, hmac }` as Base64 strings.

### 5.4 Verification & Decryption Pipeline (`decryptMessage(packet: EncryptedPacket, recipientPrivateKeyB64: string, senderPublicKeyB64: string): string`)
1. Decode Base64 `ciphertext`, `iv`, `salt`, and `hmac` into `Uint8Array` buffers.
2. Recompute `sharedSecret = X25519(recipientPrivateKey, senderPublicKey)` and re-derive `aesKey` and `hmacKey` via `HKDF-SHA256` using the packet's `salt`.
3. Recompute `expectedHmac = HMAC-SHA256(hmacKey, salt || iv || ciphertextBytes)`.
4. Perform a **constant-time byte comparison** between `expectedHmac` and `hmac`.
   - **CRITICAL SECURITY RULE:** If `expectedHmac` does not match `hmac`, immediately abort decryption and throw `new Error("HMAC_VERIFICATION_FAILED: Message tampered or corrupted in transit")`.
5. If HMAC verification succeeds, decrypt `ciphertextBytes` using `cbc(aesKey, iv).decrypt(ciphertextBytes)` and decode back to a UTF-8 string via `TextDecoder`.

### 5.5 Safety Number / Key Fingerprint (`generateSafetyNumber(myPublicKeyB64: string, peerPublicKeyB64: string): string`)
- Convert both Base64 public keys to lowercase hex strings and sort them lexicographically so both users compute the exact same string.
- Concatenate them and compute `SHA-256` (`@noble/hashes/sha256`).
- Format the first $24$ uppercase hex characters into $6$ groups of $4$ characters (e.g., `4A9F 81C2 0E7B 99D1 3F40 7B2A`) for visual out-of-band verification.

---

## 6. Backend Architecture (`/backend`)

### 6.1 Environment Variables (`backend/.env.example`)
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/e2ee_chat?retryWrites=true&w=majority
JWT_SECRET=replace_with_strong_random_secret_key
```

### 6.2 Typed Mongoose Database Models

#### `backend/src/models/User.ts`
```typescript
import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  username: string;
  passwordHash: string;
  publicKey: string; // Base64 Curve25519 public key
  createdAt: Date;
}

const userSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  publicKey: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const User = mongoose.model<IUser>('User', userSchema);
```

#### `backend/src/models/Message.ts`
*Note: Zero plaintext fields exist in this schema.*
```typescript
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMessage extends Document {
  sender: Types.ObjectId;
  recipient: Types.ObjectId;
  ciphertext: string;
  iv: string;
  salt: string;
  hmac: string;
  tamperedTest: boolean;
  timestamp: Date;
}

const messageSchema = new Schema<IMessage>({
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  ciphertext: { type: String, required: true },
  iv: { type: String, required: true },
  salt: { type: String, required: true },
  hmac: { type: String, required: true },
  tamperedTest: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
});

export const Message = mongoose.model<IMessage>('Message', messageSchema);
```

### 6.3 REST API Endpoints & Auth Middleware
- **`backend/src/middleware/authMiddleware.ts`:** Extend Express `Request` (`AuthRequest`) with `user?: { id: string; username: string }`, verify `Bearer <token>` using `jsonwebtoken`, and attach the decoded user payload.
- **`POST /api/auth/register`:** Accept `{ username, password, publicKey }`, hash password with `bcryptjs`, save user with their `Curve25519` `publicKey`, and return `{ token, user: { _id, username, publicKey } }`.
- **`POST /api/auth/login`:** Verify credentials and return `{ token, user: { _id, username, publicKey } }`.
- **`GET /api/users` (Protected):** Return list of all other registered users `[{ _id, username, publicKey }]` so clients can initiate ECDH key exchanges.
- **`GET /api/messages/:peerId` (Protected):** Fetch historical encrypted packets between `req.user.id` and `peerId` sorted by `timestamp` ascending so the mobile client can decrypt them locally.

### 6.4 Typed Socket.IO Real-Time Relay (`backend/src/socket/chatSocket.ts`)
- Authenticate socket connections using the user's JWT in `socket.handshake.auth.token`.
- Maintain a typed `Map<string, string>` (`userId -> socket.id`) in memory to track online users and broadcast `online_users` (`string[]`) updates.
- Listen for typed `send_message` events with payload `{ recipientId, ciphertext, iv, salt, hmac, tamperedTest }`:
  1. Persist the encrypted packet to MongoDB (`Message.create(...)`).
  2. Emit `receive_message` directly to `recipientId` (if online) and emit `message_sent` confirmation back to `senderId`.
  3. Log only metadata (sender ID, recipient ID, packet byte length) and never inspect or modify the ciphertext.

---

## 7. Mobile Application Architecture (`/mobile`)

### 7.1 Entry Point (`mobile/index.ts`)
Must import `'react-native-get-random-values'` on line 1 before `registerRootComponent` or `App` imports so `crypto.getRandomValues` is globally polyfilled for `@noble/*`:

```typescript
import 'react-native-get-random-values';
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
```

### 7.2 Screens & User Flow (`.tsx`)
1. **`AuthScreen.tsx` (Login / Register):**
   - Toggle between **Login** and **Create Account**.
   - On registration: call `generateIdentityKeyPair()`, save the private key in `expo-secure-store`, and send `username`, `password`, and `publicKey` to `/api/auth/register`.
   - On login: verify that the user's private key exists in `expo-secure-store` (if logging into a fresh install, display a clear notice or allow key regeneration with a warning that previous messages cannot be decrypted).
2. **`ContactsScreen.tsx` (User Directory):**
   - Displays logged-in user badge and a list of available contacts from `GET /api/users`.
   - Shows green/gray online status dot via Socket.IO `online_users`.
   - Tapping a contact navigates to `Chat` with `{ peerId, peerUsername, peerPublicKey }`.
3. **`ChatScreen.tsx` (Encrypted Messaging & Security Controls):**
   - **Header:** Displays peer's username, an **"E2EE Verified (Curve25519 + AES-256)"** lock badge, and a **"Verify Key"** button.
   - **`SafetyNumberModal.tsx`:** Triggered by "Verify Key"; displays the mutual SHA-256 Safety Number blocks and both users' truncated public keys so users can confirm no Man-in-the-Middle (MITM) key substitution occurred.
   - **Message List:** Decrypts incoming and historical messages locally using `decryptMessage()`. Displays plaintext bubbles with a lock icon.
   - **Message Input:** Encrypts text via `encryptMessage()` before emitting `send_message` over Socket.IO.

---

## 8. Security Validation & Built-in MITM Tamper Simulation (Chapter 3.5)

To validate Section 3.5 (*Message Integrity, HMAC Authentication, and MITM Attack Resilience*) without external proxy tools, include a **"Simulate MITM Tamper"** toggle/button inside `ChatScreen.tsx`:

1. When **"Simulate MITM Tamper"** is active for a test message:
   - The sender's client encrypts the message normally (`ciphertext`, `iv`, `salt`, `hmac`).
   - Before emitting over Socket.IO, the client flips 1 character in the `ciphertext` string (simulating an active Man-in-the-Middle attacker modifying data in transit) while leaving the original `hmac` untouched.
2. When the recipient's client receives the packet:
   - `decryptMessage()` recalculates `HMAC-SHA256` and detects the mismatch.
   - Decryption is immediately aborted; the tampered ciphertext is **never** rendered as plaintext.
   - The UI displays a high-visibility red **Security Alert Banner**: *"Integrity Violation Detected: HMAC verification failed. Potential Man-in-the-Middle (MITM) tampering blocked and session reset."* and logs the blocked event for demonstration.

---

## 9. Strict Implementation Rules for AI Coding Agent (Windsurf)
1. **Strict TypeScript Everywhere:** Use `.ts` and `.tsx` files across both `/backend` and `/mobile`. Avoid `any` types—define proper interfaces for all API payloads, Socket.IO events, Mongoose documents, and React Navigation props.
2. **Zero Placeholders:** Implement every function completely. Do not leave `// TODO` or mock encryption functions.
3. **Exact Algorithms:** Use `@noble/curves` (`x25519`), `@noble/ciphers` (`cbc`), and `@noble/hashes` (`hmac`, `hkdf`, `sha256`). Do not use Node's `crypto` or `Buffer` globals inside `/mobile` because they are unavailable in React Native without extra polyfills.
4. **Configurable Server URL:** Place `API_BASE_URL` in `mobile/src/config/api.ts` (defaulting to `http://192.168.1.100:5000` with a clear comment to replace with the laptop's local LAN IP or Render cloud URL) so physical phones running Expo Go can connect over Wi-Fi/hotspot immediately.
5. **Type-Check Verification:** Ensure both `backend` (`npx tsc --noEmit`) and `mobile` (`npx tsc --noEmit`) compile with zero TypeScript errors.