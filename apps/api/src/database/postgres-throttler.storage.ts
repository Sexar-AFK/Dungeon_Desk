import { Injectable } from '@nestjs/common';
import type {
  ThrottlerStorage,
} from '@nestjs/throttler';
import { PrismaService } from './prisma.service.js';

type StoredLimit = {
  totalHits: number;
  expiresAt: Date;
  isBlocked: boolean;
  blockExpiresAt: Date | null;
};

type ThrottlerStorageRecord = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};

/** Atomic PostgreSQL rate-limit counters shared by every API instance. */
@Injectable()
export class PostgresThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly prisma: PrismaService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const now = Date.now();
    const rows = await this.prisma.$queryRaw<StoredLimit[]>`
      INSERT INTO "RateLimit" ("key", "totalHits", "expiresAt", "isBlocked", "blockExpiresAt")
      VALUES (${key}, 1, ${new Date(now + ttl)}, false, NULL)
      ON CONFLICT ("key") DO UPDATE SET
        "totalHits" = CASE
          WHEN "RateLimit"."expiresAt" <= NOW() THEN 1
          WHEN "RateLimit"."isBlocked" AND "RateLimit"."blockExpiresAt" > NOW()
            THEN "RateLimit"."totalHits"
          ELSE LEAST("RateLimit"."totalHits" + 1, 2147483647)
        END,
        "expiresAt" = CASE
          WHEN "RateLimit"."expiresAt" <= NOW() THEN ${new Date(now + ttl)}
          ELSE "RateLimit"."expiresAt"
        END,
        "isBlocked" = CASE
          WHEN "RateLimit"."isBlocked" AND "RateLimit"."blockExpiresAt" > NOW() THEN true
          WHEN "RateLimit"."expiresAt" <= NOW() THEN false
          WHEN "RateLimit"."totalHits" + 1 > ${limit} THEN true
          ELSE false
        END,
        "blockExpiresAt" = CASE
          WHEN "RateLimit"."isBlocked" AND "RateLimit"."blockExpiresAt" > NOW()
            THEN "RateLimit"."blockExpiresAt"
          WHEN "RateLimit"."expiresAt" <= NOW() THEN NULL
          WHEN "RateLimit"."totalHits" + 1 > ${limit}
            THEN ${new Date(now + blockDuration)}
          ELSE NULL
        END
      RETURNING "totalHits", "expiresAt", "isBlocked", "blockExpiresAt"
    `;

    const current = rows[0];
    if (!current) throw new Error('PostgreSQL did not return the rate-limit counter.');

    if (Math.random() < 0.01) {
      await this.prisma.rateLimit.deleteMany({
        where: {
          expiresAt: { lte: new Date(now) },
          OR: [
            { blockExpiresAt: null },
            { blockExpiresAt: { lte: new Date(now) } },
          ],
        },
      });
    }

    return {
      totalHits: Number(current.totalHits),
      timeToExpire: Math.max(0, current.expiresAt.getTime() - now),
      isBlocked: current.isBlocked,
      timeToBlockExpire: current.blockExpiresAt
        ? Math.max(0, current.blockExpiresAt.getTime() - now)
        : 0,
    };
  }
}
