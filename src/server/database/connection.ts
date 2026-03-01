import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';
import { config } from '../config/env';

dotenv.config();

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

export async function connectMongo(): Promise<void> {
  if (mongoClient) return;
  mongoClient = new MongoClient(config.MONGODB_URI, {
    // use unified topology defaults
  });
  await mongoClient.connect();
  mongoDb = mongoClient.db(config.MONGODB_DB_NAME);
  console.log('[DB] Connected to MongoDB');
}

export function getDb(): Db {
  if (!mongoDb) throw new Error('MongoDB not connected — call connectMongo() first');
  return mongoDb;
}

export async function closeMongo(): Promise<void> {
  if (!mongoClient) return;
  await mongoClient.close();
  mongoClient = null;
  mongoDb = null;
  console.log('[DB] MongoDB connection closed');
}

// Minimal compatibility helpers for simple repository use. Prefer using
// `getDb().collection(<name>)` directly in new code.
export const mongo = {
  getDb,
};
