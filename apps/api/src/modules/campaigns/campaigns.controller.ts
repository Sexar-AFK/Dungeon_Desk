import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CampaignsService } from './campaigns.service.js';
import { CreateCampaignDto } from './dto/create-campaign.dto.js';
import { ListCampaignsQueryDto } from './dto/list-campaigns-query.dto.js';
import { UpdateCampaignDto } from './dto/update-campaign.dto.js';

/** HTTP endpoints for the first campaign-management slice. */
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  create(
    @Body() input: CreateCampaignDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaignsService.create(input, user.id);
  }

  @Get()
  findAll(
    @Query() query: ListCampaignsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaignsService.findAll(query, user.id);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaignsService.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() input: UpdateCampaignDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaignsService.update(id, input, user.id);
  }

  /** Archive rather than hard-delete so campaign data can be recovered later. */
  @Patch(':id/archive')
  archive(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaignsService.archive(id, user.id);
  }
}
