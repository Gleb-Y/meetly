import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { HandleReportDto } from './dto/handle-report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  createReport(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateReportDto,
  ) {
    return this.reportsService.createReport(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('pending')
  getPendingReports(@Request() req: AuthenticatedRequest) {
    if (!this.reportsService.isAdmin(req.user.id)) {
      throw new ForbiddenException('Access denied');
    }
    return this.reportsService.getPendingReports();
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/handle')
  handleReport(
    @Param('id') reportId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: HandleReportDto,
  ) {
    if (!this.reportsService.isAdmin(req.user.id)) {
      throw new ForbiddenException('Access denied');
    }
    return this.reportsService.handleReport(reportId, req.user.id, dto.action);
  }
}
