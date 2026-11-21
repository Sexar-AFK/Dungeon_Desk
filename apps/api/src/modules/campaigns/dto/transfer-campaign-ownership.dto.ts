import { IsString, MinLength } from 'class-validator';

export class TransferCampaignOwnershipDto {
  @IsString()
  @MinLength(1)
  targetUserId!: string;
}
