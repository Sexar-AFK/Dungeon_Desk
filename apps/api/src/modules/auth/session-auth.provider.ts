import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  SessionCookieProvider,
  type SessionRecord,
} from '@nestjs/authentication';
import { PrismaService } from '../../database/prisma.service.js';
import type { AuthenticatedUser } from './authenticated-user.js';

@Injectable()
export class SessionAuthProvider extends SessionCookieProvider<AuthenticatedUser> {
  constructor(
    private readonly prisma: PrismaService,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this);
  }

  async validate(session: SessionRecord): Promise<AuthenticatedUser | null> {
    return this.prisma.user.findUnique({
      where: { id: session.userId, emailVerified: true },
      select: { id: true, email: true, createdAt: true },
    });
  }
}
