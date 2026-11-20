import { IsEnum } from 'class-validator';
import { CampaignRole } from '../../../generated/prisma/enums.js';

export class UpdateCampaignMemberDto {
  @IsEnum(CampaignRole)
  role!: CampaignRole;
}
