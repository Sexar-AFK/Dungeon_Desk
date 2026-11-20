import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CredentialsDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}

export class EmailDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class VerifyEmailDto {
  @IsString()
  @MinLength(40)
  @MaxLength(128)
  token!: string;
}

export class ResetPasswordDto extends VerifyEmailDto {
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}
