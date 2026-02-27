#!/usr/bin/env node
/**
 * Sets up local PostgreSQL for development:
 *  - Creates the `postgres` role (if missing)
 *  - Creates the `flappybirds` database (if missing)
 *  - Runs the schema migration
 *
 * Connects as the current OS user (no password required on Homebrew installs).
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  // ── Step 1: connect as OS user to the default 'postgres' db ─
  const admin = new Client({ host: 'localhost', port: 5432, database: 'postgres' });
  await admin.connect();
  console.log('✔ Connected to local PostgreSQL as', admin.user ?? process.env.USER);

  // Create `postgres` role if it doesn't exist
  await admin.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'postgres') THEN
        CREATE ROLE postgres WITH LOGIN SUPERUSER PASSWORD 'postgres';
        RAISE NOTICE 'Created role: postgres';
      END IF;
    END
    $$;
  `);
  console.log('✔ Role "postgres" exists.');

  // Create `flappybirds` database if it doesn't exist
  const { rows } = await admin.query(
    "SELECT 1 FROM pg_database WHERE datname = 'flappybirds'"
  );
  if (rows.length === 0) {
    await admin.query('CREATE DATABASE flappybirds OWNER postgres');
    console.log('✔ Created database: flappybirds');
  } else {
    console.log('✔ Database "flappybirds" already exists.');
  }
  await admin.end();

  // ── Step 2: connect as postgres to flappybirds and run schema ─
  const app = new Client({
    host:     'localhost',
    port:     5432,
    user:     'postgres',
    password: 'postgres',
    database: 'flappybirds',
  });
  await app.connect();

  const schemaPath = path.join(__dirname, '..', 'src', 'server', 'database', 'schema.sql');
  const migrationPath = path.join(__dirname, '..', 'src', 'server', 'database', 'migrations', '002_advanced_features.sql');

  // Check if schema is already applied (users table exists)
  const { rows: tables } = await app.query(
    "SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public'"
  );

  if (tables.length === 0) {
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await app.query(sql);
      console.log('✔ Schema applied:', schemaPath);
    }
  } else {
    console.log('✔ Schema already applied, skipping.');
  }

  // Always try migration but ignore "already exists" errors
  if (fs.existsSync(migrationPath)) {
    try {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await app.query(sql);
      console.log('✔ Migration applied:', migrationPath);
    } catch (err) {
      if (err.code === '42P07' || err.code === '42710' || err.code === '42701' || err.message.includes('already exists')) {
        console.log('✔ Migration already applied, skipping.');
      } else {
        throw err;
      }
    }
  }

  await app.end();
  console.log('\n✔ Local database ready. You can now run ./start.sh\n');
}

run().catch(err => {
  console.error('✖ Setup failed:', err.message);
  process.exit(1);
});
