#!/usr/bin/env node
/**
 * Verifies local MongoDB is reachable for development.
 * No schema migration needed — Mongoose creates collections/indexes
 * automatically on first use, and skins are seeded at server start.
 *
 * Usage:  node scripts/setup-local-db.js
 */
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/flappybirds';

async function run() {
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  try {
    await client.connect();
    await client.db().admin().ping();
    console.log('✔ Connected to MongoDB at', MONGODB_URI);
    console.log('✔ Collections and indexes will be created automatically by Mongoose on first run.');
    console.log('✔ Skin seed data will be inserted on server start if the skins collection is empty.');
    console.log('\n✔ Local database ready. You can now run ./start.sh\n');
  } catch (err) {
    console.error('✖ Could not connect to MongoDB:', err.message);
    console.error('  Make sure MongoDB is running:');
    console.error('    brew services start mongodb-community   (macOS)');
    console.error('    sudo systemctl start mongod              (Linux)');
    console.error('    docker run -p 27017:27017 mongo:7        (Docker)');
    process.exit(1);
  } finally {
    await client.close();
  }
}

run();

