import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class CreateInvitationDto {
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().normalize('NFC').toLowerCase()
      : value,
  )
  @IsString()
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
