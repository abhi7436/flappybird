#!/usr/bin/env node
/*
  init-mongo.js
  Create recommended indexes and small setup for MongoDB collections used by the app.
  Usage: MONGODB_URI and MONGODB_DB_NAME should be set in environment or .env
*/
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB_NAME || 'flappybird';

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  console.log('[init-mongo] Connected to', uri);
  const db = client.db(dbName);

  // Users
  await db.collection('users').createIndex({ id: 1 }, { unique: true });
  await db.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true });
  await db.collection('users').createIndex({ username: 1 }, { unique: true, sparse: true });

  // Friends (prevent duplicate requester->receiver)
  await db.collection('friends').createIndex({ requester_id: 1, receiver_id: 1 }, { unique: true });
  await db.collection('friends').createIndex({ receiver_id: 1 });

  // User skins
  await db.collection('user_skins').createIndex({ user_id: 1, skin_id: 1 }, { unique: true });

  // Room invites
  await db.collection('room_invites').createIndex({ invite_code: 1 }, { unique: true });
  // TTL index to auto-remove expired invites
  await db.collection('room_invites').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });

  // Tournaments
  await db.collection('tournaments').createIndex({ id: 1 }, { unique: true });
  await db.collection('tournament_participants').createIndex({ tournament_id: 1, user_id: 1 }, { unique: true });
  await db.collection('tournament_matches').createIndex({ tournament_id: 1 });

  // Replays
  await db.collection('replays').createIndex({ room_id: 1 });
  await db.collection('replays').createIndex({ user_id: 1 });

  // Device tokens
  await db.collection('device_tokens').createIndex({ user_id: 1, token: 1 }, { unique: true });

  // Skins
  await db.collection('skins').createIndex({ id: 1 }, { unique: true });

  // Game history
  await db.collection('game_history').createIndex({ user_id: 1, created_at: -1 });
  await db.collection('game_history').createIndex({ room_id: 1 });

  console.log('[init-mongo] Indexes created or ensured.');
  await client.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('[init-mongo] Error', err);
  process.exit(1);
});
