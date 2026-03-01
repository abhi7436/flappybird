#!/usr/bin/env node
/**
 * Sets up local MongoDB for development:
 *  - Verifies MongoDB is reachable on localhost (or via MONGODB_URI)
 *  - Runs the `scripts/init-mongo.js` to create indexes
 *
 * Usage: MONGODB_URI and MONGODB_DB_NAME should be set in environment or .env
 */
const { MongoClient } = require('mongodb');
const { execFileSync } = require('child_process');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';

async function checkMongo() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
  try {
    await client.connect();
    await client.db().admin().ping();
    console.log('✔ Connected to local MongoDB at', uri);
  } finally {
    await client.close();
  }
}

async function runInit() {
  try {
    console.log('✔ Running init script: scripts/init-mongo.js');
    execFileSync(process.execPath, ['scripts/init-mongo.js'], { stdio: 'inherit' });
  } catch (err) {
    console.error('✖ Failed to run init-mongo.js', err);
    process.exit(1);
  }
}

(async () => {
  try {
    await checkMongo();
    await runInit();
    console.log('\n✔ Local MongoDB ready. You can now run ./start.sh');
    process.exit(0);
  } catch (err) {
    console.error('✖ Setup failed:', err && (err.message || err));
    process.exit(1);
  }
})();
