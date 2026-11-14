import { Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { IUser, User } from '../models/User';
import { AuthResponse } from '../types';

const router = Router();

interface RegisterBody {
  username?: string;
  password?: string;
  publicKey?: string;
}

interface LoginBody {
  username?: string;
  password?: string;
}

function buildAuthResponse(user: IUser): AuthResponse {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  const token = jwt.sign({ id: String(user._id), username: user.username }, secret, { expiresIn: '7d' });
  return { token, user: { _id: String(user._id), username: user.username, publicKey: user.publicKey } };
}

router.post('/register', async (req: Request<object, unknown, RegisterBody>, res: Response) => {
  try {
    const { username, password, publicKey } = req.body ?? {};
    if (!username || !password || !publicKey) {
      res.status(400).json({ error: 'username, password and publicKey are required' });
      return;
    }
    if (await User.findOne({ username: username.trim().toLowerCase() })) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, passwordHash, publicKey });
    res.status(201).json(buildAuthResponse(user));
  } catch (err) {
    console.error('register error', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req: Request<object, unknown, LoginBody>, res: Response) => {
  try {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      res.status(400).json({ error: 'username and password are required' });
      return;
    }
    const user = await User.findOne({ username: username.trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    res.json(buildAuthResponse(user));
  } catch (err) {
    console.error('login error', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
