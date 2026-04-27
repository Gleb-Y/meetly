import {
  IsOptional,
  IsString,
  IsNotEmpty,
  MaxLength,
  IsArray,
  ArrayMinSize,
  IsIn,
} from 'class-validator';
import { VALID_INTERESTS } from '../constants/auth.constants';

export class CompleteProfileDto {
  @IsNotEmpty({ message: 'Username is required' })
  @IsString()
  @MaxLength(30, { message: 'Username must be 30 characters or less' })
  username: string;

  @IsArray({ message: 'Interests must be an array' })
  @ArrayMinSize(1, { message: 'At least one interest is required' })
  @IsString({ each: true })
  @IsIn(VALID_INTERESTS, { each: true, message: 'Invalid interest value' })
  interests: string[];

  @IsOptional()
  @IsString()
  avatar?: string;
}
