import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { AuthenticatedUser } from './authenticated-user.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async register(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser | null> {
    const normalizedEmail = normalizeEmail(email);
    const passwordHash = await this.passwordHasher.hash(password);
    try {
      return await this.prisma.user.create({
        data: { email: normalizedEmail, passwordHash },
        select: { id: true, email: true, createdAt: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
  }

  async verifyCredentials(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: {
        id: true,
        email: true,
        createdAt: true,
        passwordHash: true,
        emailVerified: true,
      },
    });
    const storedHash = user?.passwordHash.startsWith('$scrypt$')
      ? user.passwordHash
      : undefined;
    const valid = await this.passwordHasher.verify(password, storedHash);
    if (!valid || !user || !user.emailVerified) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (this.passwordHasher.needsRehash(user.passwordHash)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await this.passwordHasher.hash(password) },
      });
    }
    const { passwordHash: _passwordHash, emailVerified: _emailVerified, ...safeUser } = user;
    return safeUser;
  }

  findUnverifiedUser(email: string) {
    return this.prisma.user.findFirst({
      where: { email: normalizeEmail(email), emailVerified: false },
      select: { id: true, email: true },
    });
  }
}

function normalizeEmail(email: string): string {
  return email.trim().normalize('NFC').toLowerCase();
}
