import { Response, Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { AuthRequest, authMiddleware } from '../middleware/authMiddleware';
import { Message } from '../models/Message';
import { User } from '../models/User';
import { PublicUser, WireMessage } from '../types';

const router = Router();

router.get('/users', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const users = await User.find({ _id: { $ne: req.user?.id } }).sort({ username: 1 });
    const payload: PublicUser[] = users.map((u) => ({ _id: String(u._id), username: u.username, publicKey: u.publicKey }));
    res.json(payload);
  } catch {
    res.status(500).json({ error: 'Failed to load users' });
  }
});

router.put('/users/key', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { publicKey } = (req.body ?? {}) as { publicKey?: string };
    if (!publicKey || typeof publicKey !== 'string') {
      res.status(400).json({ error: 'publicKey is required' });
      return;
    }
    const user = await User.findByIdAndUpdate(req.user?.id, { publicKey }, { new: true });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const payload: PublicUser = { _id: String(user._id), username: user.username, publicKey: user.publicKey };
    res.json(payload);
  } catch {
    res.status(500).json({ error: 'Failed to update key' });
  }
});

router.get('/messages/:peerId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const peerId = req.params.peerId;
    const me = req.user?.id;
    if (!me || typeof peerId !== 'string' || !isValidObjectId(peerId)) {
      res.status(400).json({ error: 'Invalid peer id' });
      return;
    }
    const docs = await Message.find({
      $or: [
        { sender: me, recipient: peerId },
        { sender: peerId, recipient: me },
      ],
    }).sort({ timestamp: 1 });
    const payload: WireMessage[] = docs.map((m) => ({
      _id: String(m._id),
      sender: m.sender.toString(),
      recipient: m.recipient.toString(),
      ciphertext: m.ciphertext,
      iv: m.iv,
      salt: m.salt,
      hmac: m.hmac,
      tamperedTest: m.tamperedTest,
      timestamp: m.timestamp.toISOString(),
    }));
    res.json(payload);
  } catch {
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

export default router;
