import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsGateway } from './reports.gateway';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { CreateReportDto } from './dto/create-report.dto';
import { BanSource, ReportStatus } from '@prisma/client';

const REPORTS_PER_TARGET_LIMIT = 3;
const REPORTS_PER_TARGET_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const AUTO_BAN_RESOLVED_THRESHOLD = 3;
const AUTO_BAN_HOURS = 48;
const ADMIN_ALERT_REPORTS_THRESHOLD = 5;
const ADMIN_ALERT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportsGateway: ReportsGateway,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Создать жалобу. Валидация: не на себя, не более 3 на одного target за 24ч.
   */
  async createReport(reporterId: string, dto: CreateReportDto) {
    if (dto.targetUserId === reporterId) {
      throw new BadRequestException('Cannot report yourself');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.targetUserId },
    });
    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    if (dto.eventId) {
      const event = await this.prisma.event.findUnique({
        where: { id: dto.eventId },
      });
      if (!event) {
        throw new NotFoundException('Event not found');
      }
    }

    const since = new Date(Date.now() - REPORTS_PER_TARGET_WINDOW_MS);
    const recentReportsOnTarget = await this.prisma.report.count({
      where: {
        reporterId,
        targetUserId: dto.targetUserId,
        createdAt: { gte: since },
      },
    });

    if (recentReportsOnTarget >= REPORTS_PER_TARGET_LIMIT) {
      throw new BadRequestException(
        `You can report the same user at most ${REPORTS_PER_TARGET_LIMIT} times in 24 hours`,
      );
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        targetUserId: dto.targetUserId,
        eventId: dto.eventId,
        reason: dto.reason,
        description: dto.description,
      },
      include: {
        reporter: { select: { id: true, username: true } },
        targetUser: { select: { id: true, username: true } },
        event: { select: { id: true, eventName: true } },
      },
    });

    this.reportsGateway.broadcastNewReport(report);

    await this.checkWeeklyReportsAlert(dto.targetUserId);

    return report;
  }

  /**
   * Обработать жалобу: ban = resolved + бан на 48ч, dismiss = dismissed.
   */
  async handleReport(reportId: string, adminId: string, action: 'ban' | 'dismiss') {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: { targetUser: true },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.status !== ReportStatus.PENDING) {
      throw new BadRequestException('Report already processed');
    }

    if (action === 'ban') {
      await this.prisma.$transaction(async (tx) => {
        await tx.report.update({
          where: { id: reportId },
          data: { status: ReportStatus.RESOLVED },
        });

        const bannedUntil = new Date(Date.now() + AUTO_BAN_HOURS * 60 * 60 * 1000);
        await tx.user.update({
          where: { id: report.targetUserId },
          data: { bannedUntil, banSource: BanSource.REPORTS },
        });
      });

      const resolvedCount = await this.prisma.report.count({
        where: {
          targetUserId: report.targetUserId,
          status: ReportStatus.RESOLVED,
        },
      });

      if (resolvedCount >= AUTO_BAN_RESOLVED_THRESHOLD) {
        await this.applyAutoBan(report.targetUserId);
      }

      this.reportsGateway.broadcastReportHandled(reportId, 'resolved', report.targetUserId);
      this.notificationsGateway.sendToUser(report.targetUserId, 'notification', {
        type: 'USER_BANNED',
        reason: 'Report resolved',
        bannedUntil: new Date(Date.now() + AUTO_BAN_HOURS * 60 * 60 * 1000).toISOString(),
        timestamp: new Date().toISOString(),
      });
    } else {
      await this.prisma.report.update({
        where: { id: reportId },
        data: { status: ReportStatus.DISMISSED },
      });

      this.reportsGateway.broadcastReportHandled(reportId, 'dismissed', report.targetUserId);
    }

    return { success: true, status: action === 'ban' ? 'resolved' : 'dismissed' };
  }

  /**
   * Автобан: 3 resolved жалобы → 48ч бан.
   */
  private async applyAutoBan(userId: string) {
    const bannedUntil = new Date(Date.now() + AUTO_BAN_HOURS * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: { bannedUntil, banSource: BanSource.REPORTS },
    });

    this.logger.warn(`Auto-ban applied: user ${userId} for 48h (3 resolved reports)`);
    this.notificationsGateway.sendToUser(userId, 'notification', {
      type: 'USER_BANNED',
      reason: '3 resolved reports',
      bannedUntil: bannedUntil.toISOString(),
      timestamp: new Date().toISOString(),
    });
    this.reportsGateway.broadcastAdminAlert({
      type: 'AUTO_BAN_APPLIED',
      userId,
      reason: '3 resolved reports',
      bannedUntil: bannedUntil.toISOString(),
    });
  }

  /**
   * 5+ жалоб от разных людей на одного юзера за неделю → уведомление админу (High).
   */
  private async checkWeeklyReportsAlert(targetUserId: string) {
    const since = new Date(Date.now() - ADMIN_ALERT_WINDOW_MS);

    const uniqueReporters = await this.prisma.report.groupBy({
      by: ['reporterId'],
      where: {
        targetUserId,
        createdAt: { gte: since },
      },
    });

    if (uniqueReporters.length >= ADMIN_ALERT_REPORTS_THRESHOLD) {
      this.reportsGateway.broadcastAdminAlert({
        type: 'HIGH_REPORTS_COUNT',
        userId: targetUserId,
        reportCount: uniqueReporters.length,
        priority: 'high',
      });
    }
  }

  async getPendingReports() {
    return this.prisma.report.findMany({
      where: { status: ReportStatus.PENDING },
      include: {
        reporter: { select: { id: true, username: true, avatar: true } },
        targetUser: { select: { id: true, username: true, avatar: true } },
        event: { select: { id: true, eventName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  isAdmin(userId: string): boolean {
    const adminIds = this.configService.get<string>('ADMIN_USER_IDS')?.split(',') ?? [];
    return adminIds.includes(userId.trim());
  }
}
