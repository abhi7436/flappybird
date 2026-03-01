import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('[DB] MONGODB_URI is not set');
  process.exit(1);
}

mongoose.set('strictQuery', true);

mongoose.connection.on('connected', () => {
  console.log('[DB] Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('[DB] MongoDB connection error', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('[DB] MongoDB disconnected');
});

/** Call once at server start-up. */
export async function connectDB(): Promise<void> {
  await mongoose.connect(uri!, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 5_000,
    socketTimeoutMS: 45_000,
  });
}

export { mongoose };
