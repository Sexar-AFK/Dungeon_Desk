import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  CampaignIcon,
  CampaignRole,
  CampaignStatus,
  CampaignThemeColor,
} from '../../generated/prisma/enums.js';
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
  let userModel: {
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  let invitationMailer: { send: ReturnType<typeof vi.fn> };
  let invitationTransaction: {
    campaign: {
      findUnique: ReturnType<typeof vi.fn>;
      findUniqueOrThrow: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    campaignInvitation: {
      findUnique: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    user: { findUnique: ReturnType<typeof vi.fn> };
    campaignMembership: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };
  let transaction: ReturnType<typeof vi.fn>;
  let campaignModel: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    campaignModel = {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
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
    userModel = { findUniqueOrThrow: vi.fn(), findUnique: vi.fn() };
    invitationMailer = { send: vi.fn() };
    invitationTransaction = {
      campaign: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        updateMany: vi.fn(),
      },
      campaignInvitation: { findUnique: vi.fn(), updateMany: vi.fn() },
      user: { findUnique: vi.fn() },
      campaignMembership: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
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
        initialLevel: 1,
        themeColor: CampaignThemeColor.GOLD,
        icon: CampaignIcon.SUN,
        tags: [],
        playerCanViewDescription: true,
        owner: { connect: { id: 'owner-1' } },
        memberships: { create: { userId: 'owner-1', role: CampaignRole.DM } },
      },
    });
  });

  it('filters the campaign list by status and case-insensitive search', async () => {
    campaignModel.findMany.mockResolvedValue([
      { ...sampleCampaign, playerCanViewDescription: true, memberships: [{ role: CampaignRole.DM }] },
    ]);

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
      include: { memberships: { where: { userId: 'owner-1' }, select: { role: true } } },
    });
  });

  it('hides campaign descriptions from players when the DM marks them private', async () => {
    campaignModel.findMany.mockResolvedValue([
      {
        ...sampleCampaign,
        description: 'Secreto del DM',
        playerCanViewDescription: false,
        memberships: [{ role: CampaignRole.PLAYER }],
      },
    ]);

    await expect(service.findAll({}, 'player-1')).resolves.toMatchObject([
      { description: null },
    ]);
  });

  it('returns dashboard data only for the current user and counts active DM invitations', async () => {
    campaignModel.findMany.mockResolvedValue([
      {
        ...sampleCampaign,
        ownerId: 'owner-1',
        memberships: [{ role: CampaignRole.DM }],
        _count: { memberships: 3, invitations: 2 },
      },
      {
        ...sampleCampaign,
        id: 'campaign-2',
        ownerId: 'other-owner',
        memberships: [{ role: CampaignRole.PLAYER }],
        _count: { memberships: 3, invitations: 2 },
      },
      {
        ...sampleCampaign,
        id: 'campaign-3',
        status: CampaignStatus.ARCHIVED,
        memberships: [{ role: CampaignRole.DM }],
        _count: { memberships: 0, invitations: 4 },
      },
    ]);

    const result = await service.findDashboard('user-1');

    expect(campaignModel.findMany).toHaveBeenCalledWith({
      where: { memberships: { some: { userId: 'user-1' } } },
      orderBy: { updatedAt: 'desc' },
      select: expect.objectContaining({
        memberships: {
          where: { userId: 'user-1' },
          select: { role: true },
        },
        _count: expect.objectContaining({
          select: expect.objectContaining({
            memberships: { where: { role: CampaignRole.PLAYER } },
            invitations: expect.objectContaining({
              where: expect.objectContaining({
                acceptedAt: null,
                revokedAt: null,
                expiresAt: { gt: expect.any(Date) },
              }),
            }),
          }),
        }),
      }),
    });
    expect(result).toMatchObject([
      {
        id: 'campaign-1',
        role: CampaignRole.DM,
        playerCount: 3,
        pendingInvitationCount: 2,
      },
      {
        id: 'campaign-2',
        role: CampaignRole.PLAYER,
        playerCount: 3,
        pendingInvitationCount: 0,
      },
      {
        id: 'campaign-3',
        role: CampaignRole.DM,
        playerCount: 0,
        pendingInvitationCount: 0,
      },
    ]);
  });

  it('returns 404 for an unknown campaign', async () => {
    campaignModel.findFirst.mockResolvedValue(null);

    await expect(service.findOne('missing', 'owner-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(campaignModel.findFirst).toHaveBeenCalledWith({
      where: { id: 'missing', memberships: { some: { userId: 'owner-1' } } },
      include: { memberships: { where: { userId: 'owner-1' }, select: { role: true } } },
    });
  });

  it('deletes only an archived campaign after exact title confirmation', async () => {
    membershipModel.findUnique.mockResolvedValue({
      role: CampaignRole.DM,
      campaign: { ...sampleCampaign, ownerId: 'owner-1', status: CampaignStatus.ARCHIVED },
    });
    campaignModel.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      service.deleteCampaign('campaign-1', sampleCampaign.title, 'owner-1'),
    ).resolves.toEqual({ deleted: true });
    expect(campaignModel.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'campaign-1',
        ownerId: 'owner-1',
        status: CampaignStatus.ARCHIVED,
        title: sampleCampaign.title,
      },
    });
  });

  it('does not permanently delete an active campaign', async () => {
    membershipModel.findUnique.mockResolvedValue({
      role: CampaignRole.DM,
      campaign: { ...sampleCampaign, ownerId: 'owner-1', status: CampaignStatus.ACTIVE },
    });

    await expect(
      service.deleteCampaign('campaign-1', sampleCampaign.title, 'owner-1'),
    ).rejects.toMatchObject({ status: 409 });
    expect(campaignModel.deleteMany).not.toHaveBeenCalled();
  });

  it('transfers ownership only to an existing DM', async () => {
    invitationTransaction.campaign.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
    invitationTransaction.campaignMembership.findUnique.mockResolvedValue({ role: CampaignRole.DM });
    invitationTransaction.campaign.updateMany.mockResolvedValue({ count: 1 });
    invitationTransaction.campaign.findUniqueOrThrow.mockResolvedValue({ ...sampleCampaign, ownerId: 'dm-2' });

    await expect(
      service.transferOwnership('campaign-1', 'dm-2', 'owner-1'),
    ).resolves.toMatchObject({ ownerId: 'dm-2' });
    expect(invitationTransaction.campaign.updateMany).toHaveBeenCalledWith({
      where: { id: 'campaign-1', ownerId: 'owner-1' },
      data: { ownerId: 'dm-2' },
    });
  });

  it('rejects ownership transfer from anyone other than the current owner', async () => {
    invitationTransaction.campaign.findUnique.mockResolvedValue({ ownerId: 'owner-2' });

    await expect(
      service.transferOwnership('campaign-1', 'dm-2', 'owner-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(invitationTransaction.campaignMembership.findUnique).not.toHaveBeenCalled();
    expect(invitationTransaction.campaign.updateMany).not.toHaveBeenCalled();
  });

  it('allows a DM to remove a player but never the campaign owner', async () => {
    membershipModel.findUnique
      .mockResolvedValueOnce({ role: CampaignRole.DM, campaign: { ownerId: 'owner-1' } })
      .mockResolvedValueOnce({ role: CampaignRole.PLAYER });
    membershipModel.delete.mockResolvedValue({});

    await expect(
      service.removeMember('campaign-1', 'player-1', 'owner-1'),
    ).resolves.toEqual({ removed: true });
    expect(membershipModel.delete).toHaveBeenCalledWith({
      where: { campaignId_userId: { campaignId: 'campaign-1', userId: 'player-1' } },
    });

    membershipModel.findUnique.mockResolvedValueOnce({
      role: CampaignRole.DM,
      campaign: { ownerId: 'owner-1' },
    });
    await expect(
      service.removeMember('campaign-1', 'owner-1', 'owner-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reserves member role changes and DM removal for the campaign owner', async () => {
    membershipModel.findUnique
      .mockResolvedValueOnce({
        role: CampaignRole.DM,
        campaign: { ...sampleCampaign, ownerId: 'owner-1' },
      })
      .mockResolvedValueOnce({
        role: CampaignRole.DM,
        campaign: { ...sampleCampaign, ownerId: 'owner-1' },
      })
      .mockResolvedValueOnce({
        role: CampaignRole.DM,
      });

    await expect(
      service.updateMemberRole('campaign-1', 'player-1', CampaignRole.DM, 'dm-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.removeMember('campaign-1', 'dm-3', 'dm-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(membershipModel.updateMany).not.toHaveBeenCalled();
    expect(membershipModel.delete).not.toHaveBeenCalled();
  });

  it('allows a non-owner member to leave but protects the owner', async () => {
    invitationTransaction.campaignMembership.findUnique.mockResolvedValueOnce({
      campaign: { ownerId: 'owner-1' },
    });
    invitationTransaction.campaignMembership.delete.mockResolvedValue({});

    await expect(service.leaveCampaign('campaign-1', 'player-1')).resolves.toEqual({ left: true });
    expect(invitationTransaction.campaignMembership.delete).toHaveBeenCalledWith({
      where: { campaignId_userId: { campaignId: 'campaign-1', userId: 'player-1' } },
    });

    invitationTransaction.campaignMembership.findUnique.mockResolvedValueOnce({
      campaign: { ownerId: 'owner-1' },
    });
    await expect(service.leaveCampaign('campaign-1', 'owner-1')).rejects.toMatchObject({ status: 400 });
  });

  it('lists incoming invitations only for a verified matching account email', async () => {
    userModel.findUnique.mockResolvedValue({ email: 'PLAYER@example.com', emailVerified: true });
    invitationModel.findMany.mockResolvedValue([]);

    await service.listPendingInvitations('player-1');

    expect(invitationModel.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        email: 'player@example.com',
        acceptedAt: null,
        revokedAt: null,
        campaign: { status: { not: CampaignStatus.ARCHIVED } },
      }),
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        campaign: { select: { id: true, title: true } },
        invitedBy: { select: { email: true } },
      },
    }));
  });

  it('does not list incoming invitations for unverified accounts', async () => {
    userModel.findUnique.mockResolvedValue({ email: 'player@example.com', emailVerified: false });

    await expect(service.listPendingInvitations('player-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(invitationModel.findMany).not.toHaveBeenCalled();
  });

  it('rejects an update that has no fields', async () => {
    await expect(
      service.update('campaign-1', {}, 'owner-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(campaignModel.findFirst).not.toHaveBeenCalled();
  });

  it('requires the dedicated archive action for the archived state', async () => {
    await expect(
      service.update('campaign-1', { status: CampaignStatus.ARCHIVED }, 'owner-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(membershipModel.findUnique).not.toHaveBeenCalled();
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

  it('accepts a listed invitation by ID only for its verified recipient', async () => {
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
      email: 'player@example.com',
      emailVerified: true,
    });
    invitationTransaction.campaignMembership.findUnique.mockResolvedValue(null);
    invitationTransaction.campaignInvitation.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.respondToInvitationById('invitation-1', 'player-1', true),
    ).resolves.toEqual({ accepted: true, campaignId: 'campaign-1' });
    expect(invitationTransaction.campaignInvitation.findUnique).toHaveBeenCalledWith({
      where: { id: 'invitation-1' },
      include: { campaign: { select: { status: true } } },
    });
  });
});
