import { IsString, MaxLength, MinLength } from 'class-validator';

export class DeletePushTokenDto {
  @IsString()
  @MinLength(16)
  @MaxLength(2048)
  token: string;
}
