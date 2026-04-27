import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminService } from './admin.service';
import { UsersService } from '../users/users.service';
import { AdminBanUserDto } from './dto/admin-ban-user.dto';

interface AuthenticatedRequest {
  user: { id: string };
}

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly usersService: UsersService,
  ) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('events/:eventId')
  getEventModeration(
    @Request() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
  ) {
    return this.adminService.getEventModerationDetail(eventId, req.user.id);
  }

  @Get('users/search')
  searchUsers(@Query('q') q: string, @Query('limit') limit?: string) {
    if (!q?.trim() || q.trim().length < 2) return [];
    return this.adminService.searchUsersForAdmin(
      q.trim(),
      parseInt(limit ?? '20', 10),
    );
  }

  @Get('users/:userId')
  getUserDetail(@Param('userId') userId: string) {
    return this.usersService.getAdminUserDetail(userId);
  }

  @Get('users/:userId/push-delivery')
  getUserPushDelivery(@Param('userId') userId: string) {
    return this.adminService.getUserPushDeliverySummary(userId);
  }

  @Post('users/:userId/ban')
  banUser(
    @Request() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() dto: AdminBanUserDto,
  ) {
    return this.adminService.banUser(req.user.id, userId, dto);
  }

  @Post('users/:userId/unban')
  unbanUser(
    @Request() req: AuthenticatedRequest,
    @Param('userId') userId: string,
  ) {
    return this.adminService.unbanUser(req.user.id, userId);
  }
}
