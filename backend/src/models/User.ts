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
