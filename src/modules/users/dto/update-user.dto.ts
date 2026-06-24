import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName!: string;

  @IsUrl()
  @IsOptional()
  avatarUrl!: string;
}
