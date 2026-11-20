import { UnauthorizedException } from '@nestjs/common';
import type { PasswordHasher } from '@nestjs/authentication';
import { PrismaService } from '../../database/prisma.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  const userRow = {
    id: 'user-1',
    email: 'player@example.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    passwordHash: '$scrypt$ln=17,r=8,p=1$salt$hash',
    emailVerified: true,
  };
  let service: AuthService;
  let userModel: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let passwordHasher: {
    hash: ReturnType<typeof vi.fn>;
    verify: ReturnType<typeof vi.fn>;
    needsRehash: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    userModel = {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    };
    passwordHasher = {
      hash: vi.fn().mockResolvedValue('$scrypt$ln=17,r=8,p=1$salt$hash'),
      verify: vi.fn().mockResolvedValue(true),
      needsRehash: vi.fn().mockReturnValue(false),
    };
    service = new AuthService(
      { user: userModel } as unknown as PrismaService,
      passwordHasher as unknown as PasswordHasher,
    );
  });

  it('normalizes email before creating an account and returns no password hash', async () => {
    userModel.create.mockResolvedValue({
      id: userRow.id,
      email: 'player@example.com',
      createdAt: userRow.createdAt,
    });

    await expect(
      service.register('  PLAYER@Example.com ', 'a-long-password'),
    ).resolves.toEqual({
      id: userRow.id,
      email: 'player@example.com',
      createdAt: userRow.createdAt,
    });
    expect(userModel.create).toHaveBeenCalledWith({
      data: {
        email: 'player@example.com',
        passwordHash: '$scrypt$ln=17,r=8,p=1$salt$hash',
      },
      select: { id: true, email: true, createdAt: true },
    });
  });

  it('does not allow a valid password to sign in before email verification', async () => {
    userModel.findUnique.mockResolvedValue({ ...userRow, emailVerified: false });

    await expect(
      service.verifyCredentials('player@example.com', 'a-long-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(passwordHasher.verify).toHaveBeenCalledWith(
      'a-long-password',
      '$scrypt$ln=17,r=8,p=1$salt$hash',
    );
  });

  it('checks a dummy hash for an unknown email and returns the same auth error', async () => {
    userModel.findUnique.mockResolvedValue(null);

    await expect(
      service.verifyCredentials('missing@example.com', 'a-long-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(passwordHasher.verify).toHaveBeenCalledWith(
      'a-long-password',
      undefined,
    );
  });
});
