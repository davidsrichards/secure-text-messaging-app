import dotenv from 'dotenv';
import cors from 'cors';
import express from 'express';
import http from 'http';
import { connectDB } from './config/db';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import { initChatSocket } from './socket/chatSocket';

dotenv.config();
async function main(): Promise<void> {
  await connectDB();
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/auth', authRoutes);
  app.use('/api', userRoutes);

  const server = http.createServer(app);
  initChatSocket(server);
  const port = Number(process.env.PORT ?? 5000);
  server.listen(port, () => console.log(`Server listening on port ${port}`));
}

main().catch((err: unknown) => {
  console.error('Fatal startup error', err);
  process.exit(1);
});
