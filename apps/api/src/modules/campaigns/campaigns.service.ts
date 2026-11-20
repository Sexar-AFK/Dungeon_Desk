import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import {
  CampaignRole,
  CampaignStatus,
  Prisma,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  CampaignInvitationMailer,
  type MailDelivery,
} from './campaign-invitation-mail.js';
import { CreateCampaignDto } from './dto/create-campaign.dto.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { ListCampaignsQueryDto } from './dto/list-campaigns-query.dto.js';
import { UpdateCampaignDto } from './dto/update-campaign.dto.js';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invitationMailer: CampaignInvitationMailer,
  ) {}

  create(input: CreateCampaignDto, ownerId: string) {
    return this.prisma.campaign.create({
      data: {
        title: input.title,
        description: input.description || null,
        edition: input.edition || 'D&D 5e · 2014',
        owner: { connect: { id: ownerId } },
        memberships: { create: { userId: ownerId, role: CampaignRole.DM } },
      },
    });
  }

  findAll(query: ListCampaignsQueryDto, ownerId: string) {
    const where: Prisma.CampaignWhereInput = {
      memberships: { some: { userId: ownerId } },
    };

    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.campaign.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, memberships: { some: { userId } } },
    });
    if (!campaign) throw new NotFoundException('Campaign not found.');
    return campaign;
  }

  async update(id: string, input: UpdateCampaignDto, ownerId: string) {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException('At least one field must be provided.');
    }

    await this.requireRole(id, ownerId, CampaignRole.DM);
    const data: Prisma.CampaignUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) {
      data.description = input.description || null;
    }
    if (input.edition !== undefined) data.edition = input.edition;
    if (input.status !== undefined) data.status = input.status;

    return this.prisma.campaign.update({
      where: { id },
      data,
    });
  }

  async archive(id: string, ownerId: string) {
    await this.requireRole(id, ownerId, CampaignRole.DM);
    return this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.ARCHIVED },
    });
  }

  async listMembers(campaignId: string, userId: string) {
    await this.findOne(campaignId, userId);
    const members = await this.prisma.campaignMembership.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'asc' },
      select: {
        userId: true,
        role: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    });
    return members.map(({ user, ...member }) => ({
      ...member,
      email: user.email,
    }));
  }

  async invite(
    campaignId: string,
    input: CreateInvitationDto,
    inviterId: string,
  ) {
    const campaign = await this.requireRole(
      campaignId,
      inviterId,
      CampaignRole.DM,
    );
    if (campaign.status === CampaignStatus.ARCHIVED) {
      throw new ConflictException('Archived campaigns cannot invite members.');
    }
    const email = normalizeEmail(input.email);
    const member = await this.prisma.campaignMembership.findFirst({
      where: { campaignId, user: { email } },
    });
    if (member)
      throw new ConflictException('This user is already a campaign member.');

    const now = new Date();
    const pending = await this.prisma.campaignInvitation.findFirst({
      where: {
        campaignId,
        email,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: { id: true },
    });
    if (pending)
      throw new ConflictException(
        'An active invitation already exists for this email.',
      );

    const token = randomBytes(32).toString('base64url');
    const invitation = await this.prisma.campaignInvitation.create({
      data: {
        campaignId,
        invitedByUserId: inviterId,
        email,
        role: CampaignRole.PLAYER,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    let delivery: MailDelivery;
    try {
      const inviter = await this.prisma.user.findUniqueOrThrow({
        where: { id: inviterId },
        select: { email: true },
      });
      delivery = await this.invitationMailer.send(
        email,
        campaign.title,
        inviter.email,
        token,
      );
    } catch (error) {
      await this.prisma.campaignInvitation.updateMany({
        where: { id: invitation.id, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw error;
    }

    return { ...invitation, delivery };
  }

  async listInvitations(campaignId: string, userId: string) {
    await this.requireRole(campaignId, userId, CampaignRole.DM);
    return this.prisma.campaignInvitation.findMany({
      where: {
        campaignId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        expiresAt: true,
      },
    });
  }

  async revokeInvitation(
    campaignId: string,
    invitationId: string,
    userId: string,
  ) {
    await this.requireRole(campaignId, userId, CampaignRole.DM);
    const result = await this.prisma.campaignInvitation.updateMany({
      where: {
        id: invitationId,
        campaignId,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    if (result.count !== 1)
      throw new NotFoundException('Invitation not found.');
    return { revoked: true };
  }

  async respondToInvitation(token: string, userId: string, accept: boolean) {
    const tokenHash = hashToken(token);
    return this.prisma.$transaction(async (transaction) => {
      const invitation = await transaction.campaignInvitation.findUnique({
        where: { tokenHash },
        include: { campaign: { select: { status: true } } },
      });
      if (
        !invitation ||
        invitation.acceptedAt ||
        invitation.revokedAt ||
        invitation.expiresAt <= new Date()
      ) {
        throw new BadRequestException('Invalid or expired invitation.');
      }
      if (invitation.campaign.status === CampaignStatus.ARCHIVED) {
        throw new BadRequestException('This campaign is archived.');
      }

      const user = await transaction.user.findUnique({
        where: { id: userId },
        select: { email: true, emailVerified: true },
      });
      if (
        !user?.emailVerified ||
        normalizeEmail(user.email) !== invitation.email
      ) {
        throw new ForbiddenException(
          'This invitation belongs to a different verified email address.',
        );
      }

      const existingMembership =
        await transaction.campaignMembership.findUnique({
          where: {
            campaignId_userId: { campaignId: invitation.campaignId, userId },
          },
        });
      if (existingMembership)
        throw new ConflictException('You are already a campaign member.');

      const now = new Date();
      const claimed = await transaction.campaignInvitation.updateMany({
        where: {
          id: invitation.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: accept ? { acceptedAt: now } : { revokedAt: now },
      });
      if (claimed.count !== 1)
        throw new BadRequestException('Invalid or expired invitation.');

      if (!accept) return { rejected: true };
      await transaction.campaignMembership.create({
        data: {
          campaignId: invitation.campaignId,
          userId,
          role: invitation.role,
        },
      });
      return { accepted: true, campaignId: invitation.campaignId };
    });
  }

  async updateMemberRole(
    campaignId: string,
    targetUserId: string,
    role: CampaignRole,
    actorId: string,
  ) {
    const campaign = await this.requireRole(
      campaignId,
      actorId,
      CampaignRole.DM,
    );
    if (campaign.ownerId !== actorId) {
      throw new ForbiddenException(
        'Only the campaign owner can change member roles.',
      );
    }
    if (targetUserId === campaign.ownerId && role !== CampaignRole.DM) {
      throw new BadRequestException('The campaign owner must remain a DM.');
    }
    const result = await this.prisma.campaignMembership.updateMany({
      where: { campaignId, userId: targetUserId },
      data: { role },
    });
    if (result.count !== 1)
      throw new NotFoundException('Campaign member not found.');
    return this.prisma.campaignMembership.findUniqueOrThrow({
      where: { campaignId_userId: { campaignId, userId: targetUserId } },
      select: { userId: true, role: true, createdAt: true },
    });
  }

  async removeMember(
    campaignId: string,
    targetUserId: string,
    actorId: string,
  ) {
    const campaign = await this.requireRole(
      campaignId,
      actorId,
      CampaignRole.DM,
    );
    if (targetUserId === campaign.ownerId) {
      throw new BadRequestException('The campaign owner cannot be removed.');
    }
    const target = await this.prisma.campaignMembership.findUnique({
      where: { campaignId_userId: { campaignId, userId: targetUserId } },
      select: { role: true },
    });
    if (!target) throw new NotFoundException('Campaign member not found.');
    if (target.role === CampaignRole.DM && campaign.ownerId !== actorId) {
      throw new ForbiddenException(
        'Only the campaign owner can remove another DM.',
      );
    }
    await this.prisma.campaignMembership.delete({
      where: { campaignId_userId: { campaignId, userId: targetUserId } },
    });
    return { removed: true };
  }

  private async requireRole(
    campaignId: string,
    userId: string,
    role: CampaignRole,
  ) {
    const membership = await this.prisma.campaignMembership.findUnique({
      where: { campaignId_userId: { campaignId, userId } },
      include: { campaign: true },
    });
    if (!membership) throw new NotFoundException('Campaign not found.');
    if (membership.role !== role && membership.role !== CampaignRole.DM) {
      throw new ForbiddenException('This action requires a campaign DM role.');
    }
    return membership.campaign;
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function normalizeEmail(email: string): string {
  return email.trim().normalize('NFC').toLowerCase();
}
