import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PostgresThrottlerStorage } from '../../database/postgres-throttler.storage.js';

/** Cross-instance hourly caps for mail actions, keyed by a non-reversible email hash. */
@Injectable()
export class EmailActionRateLimiter {
  constructor(private readonly storage: PostgresThrottlerStorage) {}

  async allow(action: 'verification' | 'password-reset', email: string) {
    const normalized = email.trim().normalize('NFC').toLowerCase();
    const fingerprint = createHash('sha256').update(normalized).digest('hex');
    const result = await this.storage.increment(
      `email-action:${action}:${fingerprint}`,
      60 * 60_000,
      3,
      60 * 60_000,
      'email-action',
    );
    return !result.isBlocked;
  }
}
