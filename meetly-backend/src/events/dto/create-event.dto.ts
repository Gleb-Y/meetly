import {
  IsString,
  IsEnum,
  IsInt,
  IsNumber,
  IsArray,
  IsBoolean,
  IsOptional,
  IsDateString,
  ArrayMaxSize,
  Min,
  Max,
  MinLength,
  MaxLength,
  ValidateIf,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { EventCategory, EventVisibility } from '@prisma/client';

export class CreateEventDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  eventName: string;

  @IsEnum(EventCategory)
  category: EventCategory;

  @IsOptional()
  @ValidateIf((o: CreateEventDto) => o.category === 'custom')
  @IsNotEmpty({
    message: 'customCategoryName is required when category is custom',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(12)
  @Matches(/^\S+$/, {
    message: 'customCategoryName must be a single word (no spaces)',
  })
  customCategoryName?: string;

  @IsOptional()
  @ValidateIf((o: CreateEventDto) => o.category === 'custom')
  @IsString()
  @MaxLength(2048)
  customCategoryIconUrl?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  description: string;

  @IsString()
  @IsOptional()
  photoUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  photoUrls?: string[];

  @IsDateString()
  date: string; // ISO format

  @IsBoolean()
  isAllDay: boolean;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsString()
  @MinLength(1)
  locationName: string;

  @IsString()
  @MinLength(1)
  locationAddress: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  locationLatitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  locationLongitude: number;

  @IsEnum(EventVisibility)
  visibility: EventVisibility;

  @IsInt()
  @Min(2)
  @Max(100)
  maxParticipants: number;
}
