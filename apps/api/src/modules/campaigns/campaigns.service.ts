import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CampaignStatus, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateCampaignDto } from './dto/create-campaign.dto.js';
import { ListCampaignsQueryDto } from './dto/list-campaigns-query.dto.js';
import { UpdateCampaignDto } from './dto/update-campaign.dto.js';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateCampaignDto, ownerId: string) {
    return this.prisma.campaign.create({
      data: {
        title: input.title,
        description: input.description || null,
        edition: input.edition || 'D&D 5e · 2014',
        owner: { connect: { id: ownerId } },
      },
    });
  }

  findAll(query: ListCampaignsQueryDto, ownerId: string) {
    const where: Prisma.CampaignWhereInput = { ownerId };

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

  async findOne(id: string, ownerId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, ownerId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found.');
    return campaign;
  }

  async update(id: string, input: UpdateCampaignDto, ownerId: string) {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException('At least one field must be provided.');
    }

    await this.findOne(id, ownerId);
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
    await this.findOne(id, ownerId);
    return this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.ARCHIVED },
    });
  }
}
