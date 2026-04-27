import { PushPlatform } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @MinLength(16)
  @MaxLength(2048)
  token: string;

  @IsEnum(PushPlatform)
  platform: PushPlatform;
}
