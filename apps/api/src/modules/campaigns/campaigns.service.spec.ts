import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CampaignStatus } from '../../generated/prisma/enums.js';
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
  let campaignModel: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    campaignModel = {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    };
    service = new CampaignsService({
      campaign: campaignModel,
    } as unknown as PrismaService);
  });

  it('creates campaigns with the default edition', async () => {
    campaignModel.create.mockResolvedValue(sampleCampaign);

    await expect(
      service.create({ title: sampleCampaign.title }),
    ).resolves.toEqual(sampleCampaign);
    expect(campaignModel.create).toHaveBeenCalledWith({
      data: {
        title: sampleCampaign.title,
        description: null,
        edition: 'D&D 5e · 2014',
      },
    });
  });

  it('filters the campaign list by status and case-insensitive search', async () => {
    campaignModel.findMany.mockResolvedValue([sampleCampaign]);

    await service.findAll({
      status: CampaignStatus.ACTIVE,
      search: 'elturel',
    });

    expect(campaignModel.findMany).toHaveBeenCalledWith({
      where: {
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
    campaignModel.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects an update that has no fields', async () => {
    await expect(service.update('campaign-1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(campaignModel.findUnique).not.toHaveBeenCalled();
  });
});
