import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsArray,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { FriendsCountVisibility } from '@prisma/client';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  @IsOptional()
  @IsInt()
  @Min(13)
  @Max(100)
  age?: number;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  /** Кто видит число друзей на вашем профиле у других пользователей */
  @IsOptional()
  @IsEnum(FriendsCountVisibility)
  friendsCountVisibility?: FriendsCountVisibility;

  /** Показывать ли блок друзей / общих друзей на профиле для других пользователей */
  @IsOptional()
  @IsBoolean()
  showFriendsInProfile?: boolean;

  /** Закрытый профиль: не-друзья видят только ник и аватар до принятия заявки */
  @IsOptional()
  @IsBoolean()
  isProfileClosed?: boolean;
}
