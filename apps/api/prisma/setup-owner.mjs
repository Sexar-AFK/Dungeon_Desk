import 'dotenv/config';
import { PasswordHasher } from '@nestjs/authentication';
import pg from 'pg';

const email = process.env.INITIAL_OWNER_EMAIL?.trim().toLowerCase();
const password = process.env.INITIAL_OWNER_PASSWORD;
const connectionString = process.env.DATABASE_URL;

if (!email || !password || !connectionString) {
  throw new Error(
    'Set INITIAL_OWNER_EMAIL, INITIAL_OWNER_PASSWORD, and DATABASE_URL before setup.',
  );
}
if (password.length < 12) {
  throw new Error('INITIAL_OWNER_PASSWORD must be at least 12 characters long.');
}
if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('INITIAL_OWNER_EMAIL must be a valid email address.');
}

const passwordHash = await new PasswordHasher().hash(password);
const client = new pg.Client({ connectionString });
let connected = false;

try {
  await client.connect();
  connected = true;
  const result = await client.query(
    `UPDATE "User"
     SET "email" = $1, "passwordHash" = $2, "emailVerified" = true, "updatedAt" = CURRENT_TIMESTAMP
     WHERE "id" = $3
       AND "email" = $4
       AND "passwordHash" = $5`,
    [
      email,
      passwordHash,
      'local-setup-owner',
      'setup-required@dungeon-desk.invalid',
      '!SETUP_REQUIRED!',
    ],
  );

  if (result.rowCount !== 1) {
    throw new Error(
      'Initial owner is already configured or the migration has not been applied; refusing to overwrite an account.',
    );
  }

  console.log('Initial owner configured.');
} finally {
  if (connected) await client.end();
}
