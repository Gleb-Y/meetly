import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ReportType } from '@prisma/client';

export class CreateReportDto {
  @IsUUID()
  targetUserId: string;

  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsEnum(ReportType)
  reason: ReportType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
