import { x25519 } from '@noble/curves/ed25519';
import { cbc } from '@noble/ciphers/aes';
import { hkdf } from '@noble/hashes/hkdf';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, concatBytes, randomBytes } from '@noble/hashes/utils';
import { EncryptedPacket, IdentityKeyPair } from '../types';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP: Record<string, number> = {};
for (let i = 0; i < B64.length; i++) B64_LOOKUP[B64.charAt(i)] = i;

const HKDF_INFO = new TextEncoder().encode('E2EE-MSG-KEY-v1');

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] as number;
    const b1 = i + 1 < bytes.length ? (bytes[i + 1] as number) : 0;
    const b2 = i + 2 < bytes.length ? (bytes[i + 2] as number) : 0;
    out += B64.charAt(b0 >> 2);
    out += B64.charAt(((b0 & 3) << 4) | (b1 >> 4));
    out += i + 1 < bytes.length ? B64.charAt(((b1 & 15) << 2) | (b2 >> 6)) : '=';
    out += i + 2 < bytes.length ? B64.charAt(b2 & 63) : '=';
  }
  return out;
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/=+$/, '');
  if (clean.length % 4 === 1) throw new Error('Invalid Base64 string');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let pos = 0;
  for (let i = 0; i < clean.length; i++) {
    const v = B64_LOOKUP[clean.charAt(i)];
    if (v === undefined) throw new Error('Invalid Base64 character');
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[pos++] = (buffer >> bits) & 0xff;
    }
  }
  return out;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export function generateIdentityKeyPair(): IdentityKeyPair {
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return { publicKey: bytesToBase64(publicKey), privateKey: bytesToBase64(privateKey) };
}

export function derivePublicKey(privateKeyB64: string): string {
  return bytesToBase64(x25519.getPublicKey(base64ToBytes(privateKeyB64)));
}

interface MessageKeys {
  aesKey: Uint8Array;
  hmacKey: Uint8Array;
}

function deriveMessageKeys(privateKeyB64: string, peerPublicKeyB64: string, salt: Uint8Array): MessageKeys {
  const sharedSecret = x25519.getSharedSecret(base64ToBytes(privateKeyB64), base64ToBytes(peerPublicKeyB64));
  const material = hkdf(sha256, sharedSecret, salt, HKDF_INFO, 64);
  return { aesKey: material.slice(0, 32), hmacKey: material.slice(32, 64) };
}

export function encryptMessage(
  plaintext: string,
  senderPrivateKeyB64: string,
  recipientPublicKeyB64: string,
): EncryptedPacket {
  const salt = randomBytes(16);
  const iv = randomBytes(16);
  const { aesKey, hmacKey } = deriveMessageKeys(senderPrivateKeyB64, recipientPublicKeyB64, salt);
  const ciphertextBytes = cbc(aesKey, iv).encrypt(new TextEncoder().encode(plaintext));
  const tag = hmac(sha256, hmacKey, concatBytes(salt, iv, ciphertextBytes));
  return {
    ciphertext: bytesToBase64(ciphertextBytes),
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt),
    hmac: bytesToBase64(tag),
  };
}

export function decryptMessage(
  packet: EncryptedPacket,
  recipientPrivateKeyB64: string,
  senderPublicKeyB64: string,
): string {
  const ciphertextBytes = base64ToBytes(packet.ciphertext);
  const iv = base64ToBytes(packet.iv);
  const salt = base64ToBytes(packet.salt);
  const receivedHmac = base64ToBytes(packet.hmac);
  const { aesKey, hmacKey } = deriveMessageKeys(recipientPrivateKeyB64, senderPublicKeyB64, salt);
  const expected = hmac(sha256, hmacKey, concatBytes(salt, iv, ciphertextBytes));
  if (!constantTimeEqual(expected, receivedHmac)) {
    throw new Error('HMAC_VERIFICATION_FAILED: Message tampered or corrupted in transit');
  }
  return new TextDecoder().decode(cbc(aesKey, iv).decrypt(ciphertextBytes));
}

export function generateSafetyNumber(myPublicKeyB64: string, peerPublicKeyB64: string): string {
  const [first, second] = [
    bytesToHex(base64ToBytes(myPublicKeyB64)),
    bytesToHex(base64ToBytes(peerPublicKeyB64)),
  ].sort();
  const digest = bytesToHex(sha256(new TextEncoder().encode(`${first}${second}`)));
  const chars = digest.slice(0, 24).toUpperCase();
  return (chars.match(/.{4}/g) ?? []).join(' ');
}
