import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { verifyToken } from '../middleware/authMiddleware';
import { IMessage, Message } from '../models/Message';
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
  WireMessage,
} from '../types';

type ChatServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

function toWire(m: IMessage): WireMessage {
  return {
    _id: String(m._id),
    sender: m.sender.toString(),
    recipient: m.recipient.toString(),
    ciphertext: m.ciphertext,
    iv: m.iv,
    salt: m.salt,
    hmac: m.hmac,
    tamperedTest: m.tamperedTest,
    timestamp: m.timestamp.toISOString(),
  };
}

export function initChatSocket(httpServer: HttpServer): ChatServer {
  const io: ChatServer = new Server(httpServer, { cors: { origin: '*' } });
  const onlineUsers = new Map<string, string>();

  io.use((socket, next) => {
    const token: unknown = socket.handshake.auth.token;
    if (typeof token !== 'string') {
      next(new Error('Authentication required'));
      return;
    }
    try {
      socket.data.user = verifyToken(token);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const senderId = socket.data.user.id;
    onlineUsers.set(senderId, socket.id);
    io.emit('online_users', Array.from(onlineUsers.keys()));

    socket.on('send_message', async (payload) => {
      try {
        const { recipientId, ciphertext, iv, salt, hmac, tamperedTest } = payload;
        const doc = await Message.create({
          sender: senderId,
          recipient: recipientId,
          ciphertext,
          iv,
          salt,
          hmac,
          tamperedTest: Boolean(tamperedTest),
        });
        const wire = toWire(doc);
        const recipientSocket = onlineUsers.get(recipientId);
        if (recipientSocket) io.to(recipientSocket).emit('receive_message', wire);
        socket.emit('message_sent', wire);
        console.log(`relay sender=${senderId} recipient=${recipientId} bytes=${Buffer.byteLength(ciphertext, 'utf8')}`);
      } catch (err) {
        console.error('send_message failed', err instanceof Error ? err.message : err);
      }
    });

    socket.on('disconnect', () => {
      if (onlineUsers.get(senderId) === socket.id) onlineUsers.delete(senderId);
      io.emit('online_users', Array.from(onlineUsers.keys()));
    });
  });

  return io;
}
