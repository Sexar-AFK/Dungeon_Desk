import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CampaignRole, CampaignStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../database/prisma.service.js';
import { CampaignsService } from './campaigns.service.js';

describe('CampaignsService', () => {
  const sampleCampaign = {
    id: 'campaign-1',
    title: 'La caída de Elturel',
    description: 'Una ciudad perdida.',
    edition: 'D&D 5e · 2014',
    status: CampaignStatus.ACTIVE,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  let service: CampaignsService;
  let membershipModel: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let invitationModel: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  let userModel: { findUniqueOrThrow: ReturnType<typeof vi.fn> };
  let invitationMailer: { send: ReturnType<typeof vi.fn> };
  let invitationTransaction: {
    campaignInvitation: {
      findUnique: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    user: { findUnique: ReturnType<typeof vi.fn> };
    campaignMembership: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
  };
  let transaction: ReturnType<typeof vi.fn>;
  let campaignModel: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    campaignModel = {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    };
    membershipModel = {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    };
    invitationModel = {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    };
    userModel = { findUniqueOrThrow: vi.fn() };
    invitationMailer = { send: vi.fn() };
    invitationTransaction = {
      campaignInvitation: { findUnique: vi.fn(), updateMany: vi.fn() },
      user: { findUnique: vi.fn() },
      campaignMembership: { findUnique: vi.fn(), create: vi.fn() },
    };
    transaction = vi.fn(
      (callback: (client: typeof invitationTransaction) => unknown) =>
        callback(invitationTransaction),
    );
    service = new CampaignsService(
      {
        campaign: campaignModel,
        campaignMembership: membershipModel,
        campaignInvitation: invitationModel,
        user: userModel,
        $transaction: transaction,
      } as unknown as PrismaService,
      invitationMailer as never,
    );
  });

  it('creates campaigns with the default edition', async () => {
    campaignModel.create.mockResolvedValue(sampleCampaign);

    await expect(
      service.create({ title: sampleCampaign.title }, 'owner-1'),
    ).resolves.toEqual(sampleCampaign);
    expect(campaignModel.create).toHaveBeenCalledWith({
      data: {
        title: sampleCampaign.title,
        description: null,
        edition: 'D&D 5e · 2014',
        owner: { connect: { id: 'owner-1' } },
        memberships: { create: { userId: 'owner-1', role: CampaignRole.DM } },
      },
    });
  });

  it('filters the campaign list by status and case-insensitive search', async () => {
    campaignModel.findMany.mockResolvedValue([sampleCampaign]);

    await service.findAll(
      { status: CampaignStatus.ACTIVE, search: 'elturel' },
      'owner-1',
    );

    expect(campaignModel.findMany).toHaveBeenCalledWith({
      where: {
        memberships: { some: { userId: 'owner-1' } },
        status: CampaignStatus.ACTIVE,
        OR: [
          { title: { contains: 'elturel', mode: 'insensitive' } },
          { description: { contains: 'elturel', mode: 'insensitive' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('returns 404 for an unknown campaign', async () => {
    campaignModel.findFirst.mockResolvedValue(null);

    await expect(service.findOne('missing', 'owner-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(campaignModel.findFirst).toHaveBeenCalledWith({
      where: { id: 'missing', memberships: { some: { userId: 'owner-1' } } },
    });
  });

  it('rejects an update that has no fields', async () => {
    await expect(
      service.update('campaign-1', {}, 'owner-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(campaignModel.findFirst).not.toHaveBeenCalled();
  });

  it('allows a player to read a campaign but not edit it', async () => {
    membershipModel.findUnique.mockResolvedValue({
      role: CampaignRole.PLAYER,
      campaign: { ...sampleCampaign, ownerId: 'owner-1' },
    });

    await expect(
      service.update('campaign-1', { title: 'Nope' }, 'player-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(campaignModel.update).not.toHaveBeenCalled();
  });

  it('creates email invitations with a stored token hash and no raw token in the response', async () => {
    membershipModel.findUnique.mockResolvedValue({
      role: CampaignRole.DM,
      campaign: { ...sampleCampaign, ownerId: 'owner-1' },
    });
    membershipModel.findFirst.mockResolvedValue(null);
    invitationModel.findFirst.mockResolvedValue(null);
    invitationMailer.send.mockResolvedValue('smtp');
    invitationModel.create.mockImplementation(async ({ data, select }) => ({
      id: 'invitation-1',
      email: data.email,
      role: data.role,
      createdAt: new Date(),
      expiresAt: data.expiresAt,
      ...(select ? {} : {}),
    }));
    userModel.findUniqueOrThrow.mockResolvedValue({ email: 'dm@example.com' });

    const result = await service.invite(
      'campaign-1',
      { email: ' PLAYER@EXAMPLE.COM ' },
      'owner-1',
    );

    expect(result).toMatchObject({
      id: 'invitation-1',
      email: 'player@example.com',
      delivery: 'smtp',
    });
    expect(result).not.toHaveProperty('tokenHash');
    expect(invitationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'player@example.com',
          invitedByUserId: 'owner-1',
          role: CampaignRole.PLAYER,
          tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
    expect(invitationMailer.send).toHaveBeenCalledWith(
      'player@example.com',
      sampleCampaign.title,
      'dm@example.com',
      expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    );
  });

  it('accepts a single-use invitation only for its matching verified email', async () => {
    const token = 'a'.repeat(43);
    invitationTransaction.campaignInvitation.findUnique.mockResolvedValue({
      id: 'invitation-1',
      campaignId: 'campaign-1',
      campaign: { status: CampaignStatus.ACTIVE },
      email: 'player@example.com',
      role: CampaignRole.PLAYER,
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
      revokedAt: null,
    });
    invitationTransaction.user.findUnique.mockResolvedValue({
      email: 'PLAYER@example.com',
      emailVerified: true,
    });
    invitationTransaction.campaignMembership.findUnique.mockResolvedValue(null);
    invitationTransaction.campaignInvitation.updateMany.mockResolvedValue({
      count: 1,
    });

    await expect(
      service.respondToInvitation(token, 'player-1', true),
    ).resolves.toEqual({
      accepted: true,
      campaignId: 'campaign-1',
    });
    expect(
      invitationTransaction.campaignInvitation.findUnique,
    ).toHaveBeenCalledWith({
      where: { tokenHash: createHash('sha256').update(token).digest('hex') },
      include: { campaign: { select: { status: true } } },
    });
    expect(
      invitationTransaction.campaignMembership.create,
    ).toHaveBeenCalledWith({
      data: {
        campaignId: 'campaign-1',
        userId: 'player-1',
        role: CampaignRole.PLAYER,
      },
    });
  });

  it('does not consume an invitation when a different email tries to accept it', async () => {
    invitationTransaction.campaignInvitation.findUnique.mockResolvedValue({
      id: 'invitation-1',
      campaignId: 'campaign-1',
      campaign: { status: CampaignStatus.ACTIVE },
      email: 'invited@example.com',
      role: CampaignRole.PLAYER,
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
      revokedAt: null,
    });
    invitationTransaction.user.findUnique.mockResolvedValue({
      email: 'other@example.com',
      emailVerified: true,
    });

    await expect(
      service.respondToInvitation('b'.repeat(43), 'other-user', true),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      invitationTransaction.campaignInvitation.updateMany,
    ).not.toHaveBeenCalled();
    expect(
      invitationTransaction.campaignMembership.create,
    ).not.toHaveBeenCalled();
  });
});
