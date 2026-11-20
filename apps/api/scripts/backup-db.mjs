import { spawn } from 'node:child_process';
import { chmod, mkdir, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL;
const recipient = process.env.BACKUP_AGE_RECIPIENT;
if (!databaseUrl || !recipient) {
  throw new Error('DATABASE_URL and BACKUP_AGE_RECIPIENT are required.');
}

const url = new URL(databaseUrl);
if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
  throw new Error('DATABASE_URL must use PostgreSQL.');
}

const outputDirectory = resolve(process.env.BACKUP_DIR ?? 'backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputPath = join(outputDirectory, `dungeon-desk-${timestamp}.dump.age`);
const temporaryPath = `${outputPath}.${randomUUID()}.tmp`;
await mkdir(outputDirectory, { recursive: true, mode: 0o700 });

const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
const username = decodeURIComponent(url.username);
const password = decodeURIComponent(url.password);
const pgEnv = {
  ...process.env,
  DATABASE_URL: undefined,
  PGPASSWORD: password,
  ...(url.searchParams.get('sslmode') && {
    PGSSLMODE: url.searchParams.get('sslmode'),
  }),
  ...(url.searchParams.get('sslrootcert') && {
    PGSSLROOTCERT: url.searchParams.get('sslrootcert'),
  }),
};
const dump = spawn(
  'pg_dump',
  [
    '--format=custom',
    '--no-owner',
    '--no-acl',
    '--host',
    url.hostname,
    '--port',
    url.port || '5432',
    '--username',
    username,
    '--dbname',
    databaseName,
  ],
  { env: pgEnv, stdio: ['ignore', 'pipe', 'inherit'] },
);
const encrypt = spawn(
  'age',
  ['--encrypt', '--recipient', recipient, '--output', temporaryPath],
  { stdio: ['pipe', 'inherit', 'inherit'] },
);

const dumpExit = waitForExit(dump, 'pg_dump');
const encryptExit = waitForExit(encrypt, 'age');
encrypt.stdin.on('error', () => dump.kill('SIGTERM'));
dump.stdout.on('error', () => encrypt.kill('SIGTERM'));
dump.stdout.pipe(encrypt.stdin);

try {
  const [dumpCode, encryptCode] = await Promise.all([dumpExit, encryptExit]);
  if (dumpCode !== 0 || encryptCode !== 0) {
    throw new Error(`Backup failed (pg_dump=${dumpCode}, age=${encryptCode}).`);
  }
  await chmod(temporaryPath, 0o600);
  await rename(temporaryPath, outputPath);
  console.log(`Encrypted database backup written to ${outputPath}`);
} catch (error) {
  dump.kill('SIGTERM');
  encrypt.kill('SIGTERM');
  await rm(temporaryPath, { force: true });
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
