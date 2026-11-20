import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL;
const identityFile = process.env.BACKUP_AGE_IDENTITY;
const backupFile = process.argv[2];
if (!databaseUrl || !identityFile || !backupFile) {
  throw new Error(
    'DATABASE_URL, BACKUP_AGE_IDENTITY, and a .dump.age file argument are required.',
  );
}

const url = new URL(databaseUrl);
if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
  throw new Error('DATABASE_URL must use PostgreSQL.');
}
const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
if (process.env.CONFIRM_RESTORE_DB !== databaseName) {
  throw new Error(
    `Set CONFIRM_RESTORE_DB=${databaseName} to confirm this destructive restore.`,
  );
}

const pgEnv = {
  ...process.env,
  DATABASE_URL: undefined,
  PGPASSWORD: decodeURIComponent(url.password),
  ...(url.searchParams.get('sslmode') && {
    PGSSLMODE: url.searchParams.get('sslmode'),
  }),
  ...(url.searchParams.get('sslrootcert') && {
    PGSSLROOTCERT: url.searchParams.get('sslrootcert'),
  }),
};
const age = spawn(
  'age',
  ['--decrypt', '--identity', resolve(identityFile), resolve(backupFile)],
  { stdio: ['ignore', 'pipe', 'inherit'] },
);
const restore = spawn(
  'pg_restore',
  [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-acl',
    '--exit-on-error',
    '--single-transaction',
    '--host',
    url.hostname,
    '--port',
    url.port || '5432',
    '--username',
    decodeURIComponent(url.username),
    '--dbname',
    databaseName,
  ],
  { env: pgEnv, stdio: ['pipe', 'inherit', 'inherit'] },
);

restore.stdin.on('error', () => age.kill('SIGTERM'));
age.stdout.on('error', () => restore.kill('SIGTERM'));
age.stdout.pipe(restore.stdin);
try {
  const [ageCode, restoreCode] = await Promise.all([
    waitForExit(age, 'age'),
    waitForExit(restore, 'pg_restore'),
  ]);
  if (ageCode !== 0 || restoreCode !== 0) {
    throw new Error(`Restore failed (age=${ageCode}, pg_restore=${restoreCode}).`);
  }
  console.log(`Encrypted backup restored into database ${databaseName}.`);
} catch (error) {
  age.kill('SIGTERM');
  restore.kill('SIGTERM');
  throw error;
}

function waitForExit(child, name) {
  return new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === null) reject(new Error(`${name} was terminated.`));
      else resolveExit(code);
    });
  });
}
