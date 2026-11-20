import { Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  type EmailTokenPurpose,
  type EmailTokenRecord,
  type EmailTokenStore,
  type SessionRecord,
  type SessionStore,
} from '@nestjs/authentication';
import { PrismaService } from '../../database/prisma.service.js';

/** PostgreSQL-backed sessions; session IDs are SHA-256 hashes of cookie tokens. */
@Injectable()
export class AuthenticationStore implements SessionStore, EmailTokenStore {
  constructor(
    private readonly prisma: PrismaService,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ sessions: this, emailTokens: this });
  }

  async getSession(id: string): Promise<SessionRecord | undefined> {
    const row = await this.prisma.session.findUnique({ where: { id } });
    if (!row) return undefined;
    return {
      id: row.id,
      userId: row.userId,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      lastActiveAt: row.lastActiveAt,
      ...(row.mfa ? { mfa: row.mfa as SessionRecord['mfa'] } : {}),
      ...(row.metadata && typeof row.metadata === 'object'
        ? { metadata: row.metadata as Record<string, unknown> }
        : {}),
    };
  }

  async createSession(record: SessionRecord): Promise<void> {
    await this.prisma.session.create({
      data: {
        id: record.id,
        userId: record.userId,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        lastActiveAt: record.lastActiveAt,
        mfa: record.mfa,
        metadata: record.metadata as object | undefined,
      },
    });
    await this.prisma.session.deleteMany({
      where: { expiresAt: { lte: record.createdAt } },
    });
  }

  async touchSession(id: string, lastActiveAt: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id, lastActiveAt: { lt: lastActiveAt } },
      data: { lastActiveAt },
    });
  }

  async deleteSession(id: string): Promise<boolean> {
    const { count } = await this.prisma.session.deleteMany({ where: { id } });
    return count === 1;
  }

  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    const rows = await this.prisma.session.findMany({ where: { userId } });
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      lastActiveAt: row.lastActiveAt,
      ...(row.mfa ? { mfa: row.mfa as SessionRecord['mfa'] } : {}),
      ...(row.metadata && typeof row.metadata === 'object'
        ? { metadata: row.metadata as Record<string, unknown> }
        : {}),
    }));
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId } });
  }

  async saveEmailToken(record: EmailTokenRecord): Promise<void> {
    await this.prisma.emailToken.deleteMany({
      where: { expiresAt: { lte: record.createdAt } },
    });
    await this.prisma.emailToken.create({ data: record });
    // Keep token storage bounded even if an address is repeatedly targeted.
    await this.prisma.$executeRaw`
      DELETE FROM "EmailToken"
      WHERE "id" IN (
        SELECT "id" FROM "EmailToken"
        ORDER BY "expiresAt" DESC
        OFFSET 100000
      )
    `;
  }

  async consumeEmailToken(
    id: string,
    purpose: EmailTokenPurpose,
  ): Promise<EmailTokenRecord | undefined> {
    const rows = await this.prisma.$queryRaw<EmailTokenRecord[]>`
      DELETE FROM "EmailToken"
      WHERE "id" = ${id} AND "purpose" = ${purpose}
      RETURNING "id", "purpose", "userId", "email", "fingerprint", "createdAt", "expiresAt"
    `;
    return rows[0];
  }

  async deleteUserEmailTokens(
    userId: string,
    purpose: EmailTokenPurpose,
  ): Promise<void> {
    await this.prisma.emailToken.deleteMany({ where: { userId, purpose } });
  }
}
