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
