import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  CampaignIcon,
  CampaignThemeColor,
} from '../../../generated/prisma/enums.js';

/** Safe, typed campaign preferences accepted by create and update operations. */
export class CampaignSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  initialLevel?: number;

  @IsOptional()
  @IsEnum(CampaignThemeColor)
  themeColor?: CampaignThemeColor;

  @IsOptional()
  @IsEnum(CampaignIcon)
  icon?: CampaignIcon;

  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((tag) => (typeof tag === 'string' ? tag.trim() : tag))
      : value,
  )
  @IsArray()
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(24, { each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  playerCanViewDescription?: boolean;
}
