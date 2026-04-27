import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BanSource,
  EventVisibility,
  FriendRequestStatus,
  ReportStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { ChatGateway } from '../chat/chat.gateway';
import { PushNotificationService } from '../notifications/push-notification.service';
import { AdminBanUserDto } from './dto/admin-ban-user.dto';

const PERMANENT_BAN_UNTIL = new Date('2099-12-31T23:59:59.999Z');
const DEFAULT_ADMIN_BAN_HOURS = 48;

const MODERATION_CHAT_MESSAGE_PREVIEW = 50;

const CREATOR_MODERATION_SELECT = {
  id: true,
  username: true,
  avatar: true,
  phoneNumber: true,
} as const;

function utcDayStart(reference: Date, daysAgoFromRef: number): Date {
  const x = new Date(reference);
  x.setUTCDate(x.getUTCDate() - daysAgoFromRef);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

function addUtcDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/** Monday 00:00 UTC of the week containing `reference`. */
function startOfUtcWeekMonday(reference: Date): Date {
  const dayStart = utcDayStart(reference, 0);
  const dow = dayStart.getUTCDay();
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;
  return addUtcDays(dayStart, -daysSinceMonday);
}

/** Seven intervals from oldest (6 days ago) to today, UTC calendar days. */
function lastSevenUtcDayBounds(reference: Date): { start: Date; end: Date }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const daysAgo = 6 - i;
    const start = utcDayStart(reference, daysAgo);
    const end = addUtcDays(start, 1);
    return { start, end };
  });
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly chatGateway: ChatGateway,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  async getStats() {
    const now = new Date();
    const notificationsOnlineUsers =
      this.notificationsGateway.countOnlineNotificationUsers();
    const chatRealtime = this.chatGateway.getAdminRealtimeSnapshot();
    const bounds = lastSevenUtcDayBounds(now);
    const todayStart = utcDayStart(now, 0);
    const tomorrow = addUtcDays(todayStart, 1);
    const weekStart = startOfUtcWeekMonday(now);

    const [
      usersTotal,
      usersActive,
      usersBannedNow,
      usersNewToday,
      usersNewThisWeek,
      eventsTotal,
      eventsActive,
      eventsPublicActive,
      eventsNewToday,
      eventsNewThisWeek,
      reportsPending,
      reportsTotal,
      reportsHandled,
      reportsNewToday,
      messagesTotal,
      messagesNewToday,
      chatsTotal,
      friendshipsTotal,
      friendRequestsPending,
      pushTokensActive,
      usersGrowthLast7Days,
      eventsGrowthLast7Days,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { bannedUntil: { gt: now } } }),
      this.prisma.user.count({
        where: { createdAt: { gte: todayStart, lt: tomorrow } },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: weekStart, lte: now } },
      }),
      this.prisma.event.count(),
      this.prisma.event.count({ where: { isActive: true } }),
      this.prisma.event.count({
        where: {
          isActive: true,
          visibility: EventVisibility.PUBLIC,
        },
      }),
      this.prisma.event.count({
        where: { createdAt: { gte: todayStart, lt: tomorrow } },
      }),
      this.prisma.event.count({
        where: { createdAt: { gte: weekStart, lte: now } },
      }),
      this.prisma.report.count({ where: { status: ReportStatus.PENDING } }),
      this.prisma.report.count(),
      this.prisma.report.count({
        where: {
          status: { in: [ReportStatus.RESOLVED, ReportStatus.DISMISSED] },
        },
      }),
      this.prisma.report.count({
        where: { createdAt: { gte: todayStart, lt: tomorrow } },
      }),
      this.prisma.message.count(),
      this.prisma.message.count({
        where: { createdAt: { gte: todayStart, lt: tomorrow } },
      }),
      this.prisma.chat.count(),
      this.prisma.friendship.count(),
      this.prisma.friendRequest.count({
        where: { status: FriendRequestStatus.PENDING },
      }),
      this.prisma.pushToken.count({ where: { isActive: true } }),
      Promise.all(
        bounds.map(({ start, end }) =>
          this.prisma.user.count({
            where: { createdAt: { gte: start, lt: end } },
          }),
        ),
      ),
      Promise.all(
        bounds.map(({ start, end }) =>
          this.prisma.event.count({
            where: { createdAt: { gte: start, lt: end } },
          }),
        ),
      ),
    ]);

    return {
      generatedAt: now.toISOString(),
      users: {
        total: usersTotal,
        banned: usersBannedNow,
        newToday: usersNewToday,
        newThisWeek: usersNewThisWeek,
        growthLast7Days: usersGrowthLast7Days,
        active: usersActive,
      },
      events: {
        total: eventsTotal,
        active: eventsActive,
        publicActive: eventsPublicActive,
        newToday: eventsNewToday,
        newThisWeek: eventsNewThisWeek,
        growthLast7Days: eventsGrowthLast7Days,
      },
      reports: {
        pending: reportsPending,
        total: reportsTotal,
        handled: reportsHandled,
        newToday: reportsNewToday,
      },
      messages: { total: messagesTotal, newToday: messagesNewToday },
      chats: { total: chatsTotal },
      friendRequests: { pending: friendRequestsPending },
      friendships: { total: friendshipsTotal },
      pushTokens: { active: pushTokensActive },
      realtime: {
        notifications: {
          usersOnline: notificationsOnlineUsers,
        },
        chat: {
          namespace: {
            uniqueUsers: chatRealtime.chatNamespace.uniqueUsers,
            totalSockets: chatRealtime.chatNamespace.totalSockets,
          },
          joinChatPresence: {
            uniqueUsers: chatRealtime.joinChatPresence.uniqueUsers,
          },
        },
      },
    };
  }

  async searchUsersForAdmin(query: string, limit: number) {
    const now = new Date();
    const capped = Math.min(Math.max(1, limit), 100);
    const rows = await this.prisma.user.findMany({
      where: {
        username: { contains: query, mode: 'insensitive' },
      },
      select: {
        id: true,
        username: true,
        avatar: true,
        isActive: true,
        bannedUntil: true,
        phoneNumber: true,
      },
      take: capped,
    });
    return rows.map((r) => ({
      ...r,
      isBannedNow: !!(r.bannedUntil && r.bannedUntil > now),
    }));
  }

  async banUser(adminId: string, targetUserId: string, dto: AdminBanUserDto) {
    if (adminId === targetUserId) {
      throw new BadRequestException('Cannot ban yourself');
    }
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException('User not found');
    }

    const bannedUntil = dto.permanent
      ? PERMANENT_BAN_UNTIL
      : new Date(
          Date.now() +
            (dto.durationHours ?? DEFAULT_ADMIN_BAN_HOURS) * 60 * 60 * 1000,
        );

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        bannedUntil,
        banSource: BanSource.ADMIN,
      },
    });

    this.notificationsGateway.sendToUser(targetUserId, 'notification', {
      type: 'USER_BANNED',
      reason: 'Administrative action',
      bannedUntil: bannedUntil.toISOString(),
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      bannedUntil: bannedUntil.toISOString(),
      banSource: BanSource.ADMIN,
    };
  }

  async unbanUser(_adminId: string, targetUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, bannedUntil: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const now = new Date();
    if (!user.bannedUntil || user.bannedUntil <= now) {
      return { success: true, alreadyUnbanned: true };
    }

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        bannedUntil: null,
        banSource: BanSource.NONE,
      },
    });

    return { success: true, alreadyUnbanned: false };
  }

  /**
   * Просмотр ивента для модерации: всегда chatId + участники + превью чата.
   * Админ не считается участником (isUserParticipant: false); если он в БД в участниках — убирается из списка для UI.
   */
  async getEventModerationDetail(eventId: string, adminUserId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        creator: { select: CREATOR_MODERATION_SELECT },
        participants: {
          include: {
            user: { select: { id: true, username: true, avatar: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
        chat: {
          select: {
            id: true,
            lastMessageAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        _count: { select: { participants: true } },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const chatId = event.chat?.id ?? null;

    let messagesPreview: Array<{
      id: string;
      content: string;
      imageUrl: string | null;
      isSystem: boolean;
      createdAt: Date;
      updatedAt: Date;
      senderId: string;
      replyToId: string | null;
      sender: { id: string; username: string | null; avatar: string | null };
    }> = [];

    if (chatId) {
      const msgs = await this.prisma.message.findMany({
        where: { chatId },
        orderBy: { createdAt: 'desc' },
        take: MODERATION_CHAT_MESSAGE_PREVIEW,
        select: {
          id: true,
          content: true,
          imageUrl: true,
          isSystem: true,
          createdAt: true,
          updatedAt: true,
          senderId: true,
          replyToId: true,
          sender: {
            select: { id: true, username: true, avatar: true },
          },
        },
      });
      messagesPreview = msgs.slice().reverse();
    }

    const participantsTotalCount = event._count.participants;
    const viewerWasParticipant = event.participants.some(
      (p) => p.userId === adminUserId,
    );

    const participants = event.participants
      .filter((p) => p.userId !== adminUserId)
      .map((p) => ({
        id: p.user.id,
        username: p.user.username,
        avatar: p.user.avatar,
        userId: p.userId,
        joinedAt: p.joinedAt,
        isCreator: p.userId === event.creatorId,
      }));

    const {
      participants: _rawParts,
      chat: _chatRow,
      _count: _c,
      creator,
      ...eventScalars
    } = event;

    return {
      moderationGuestView: true,
      isUserParticipant: false,
      joinRequestStatus: null,
      viewerExcludedFromParticipantList: viewerWasParticipant,
      participantsTotalCount,
      participantsCount: participantsTotalCount,
      participants,
      title: event.eventName,
      chatId,
      chat: chatId
        ? {
            id: chatId,
            lastMessageAt: event.chat!.lastMessageAt,
            messagesPreview,
          }
        : null,
      creator,
      ...eventScalars,
    };
  }

  /**
   * Diagnose push delivery for a user: active tokens, last FCM errors (no raw FCM secrets).
   */
  async getUserPushDeliverySummary(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const tokens = await this.prisma.pushToken.findMany({
      where: { userId },
      select: {
        id: true,
        platform: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastSeenAt: true,
        lastErrorCode: true,
        lastErrorAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const activeTokenCount = tokens.filter((t) => t.isActive).length;

    return {
      userId,
      fcmDeliveryConfigured: this.pushNotificationService.isDeliveryConfigured(),
      activeTokenCount,
      tokenRowCount: tokens.length,
      tokens,
    };
  }
}
