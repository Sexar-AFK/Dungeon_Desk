import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service.js';
import { CreateCampaignDto } from './dto/create-campaign.dto.js';
import { ListCampaignsQueryDto } from './dto/list-campaigns-query.dto.js';
import { UpdateCampaignDto } from './dto/update-campaign.dto.js';

/** HTTP endpoints for the first campaign-management slice. */
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  create(@Body() input: CreateCampaignDto) {
    return this.campaignsService.create(input);
  }

  @Get()
  findAll(@Query() query: ListCampaignsQueryDto) {
    return this.campaignsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: UpdateCampaignDto) {
    return this.campaignsService.update(id, input);
  }

  /** Archive rather than hard-delete so campaign data can be recovered later. */
  @Patch(':id/archive')
  archive(@Param('id') id: string) {
    return this.campaignsService.archive(id);
  }
}
