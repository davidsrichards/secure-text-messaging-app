import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthPayload } from '../types';

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export function verifyToken(token: string): AuthPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  const decoded = jwt.verify(token, secret);
  if (typeof decoded === 'string' || typeof decoded.id !== 'string' || typeof decoded.username !== 'string') {
    throw new Error('Invalid token payload');
  }
  return { id: decoded.id, username: decoded.username };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
