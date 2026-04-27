import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
import { PUSH_POLICY, PushPayload, PushType } from '../notifications/push.types';
import { EventStatus, AttendanceStatus } from '@prisma/client';
import { organizerRatingViewerState } from './organizer-rating.helpers';
import { startOfDayUtc } from './event-time.helpers';
import {
  applyKarmaDelta,
  KARMA_DELTA_ATTEND,
  KARMA_NO_SHOW_PENALTY,
} from './karma.constants';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const NOTIFY_CHUNK_SIZE = 10;

@Injectable()
export class EventSchedulerService {
  private readonly logger = new Logger(EventSchedulerService.name);
  private isExpiring = false;
  private isFinalizing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
    private readonly notificationDispatcher: NotificationDispatcherService,
  ) {}

  /**
   * Каждую минуту: ACTIVE → COMPLETED когда время ивента истекло.
   * Ивент пропадает с карты, но чек-ин ещё доступен 2 часа.
   * All-day: сравнение `date` с началом календарного дня в UTC (см. startOfDayUtc).
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredEvents() {
    if (this.isExpiring) return;
    this.isExpiring = true;

    try {
      const now = new Date();

      const expiredEvents = await this.prisma.event.findMany({
        where: {
          status: EventStatus.ACTIVE,
          isActive: true,
          OR: [
            { endTime: { not: null, lt: now } },
            {
              isAllDay: true,
              endTime: null,
              date: { lt: startOfDayUtc(now) },
            },
            { isAllDay: false, endTime: null, date: { lt: now } },
          ],
        },
        select: {
          id: true,
          eventName: true,
          chat: { select: { id: true } },
          participants: { select: { userId: true } },
        },
      });

      if (expiredEvents.length === 0) return;

      this.logger.log(
        `Found ${expiredEvents.length} expired event(s), completing...`,
      );

      await this.prisma.event.updateMany({
        where: { id: { in: expiredEvents.map((e) => e.id) } },
        data: { status: EventStatus.COMPLETED },
      });

      for (const event of expiredEvents) {
        const participantIds = event.participants.map((p) => p.userId);

        if (event.chat) {
          try {
            const systemUserId = participantIds[0];
            if (systemUserId) {
              await this.chatGateway.broadcastSystemMessage(
                event.chat.id,
                systemUserId,
                'Событие завершено. У организатора есть 2 часа для отметки присутствия.',
              );
            }

            this.chatGateway.server
              .to(`chat:${event.chat.id}`)
              .emit('chatStatusChanged', {
                chatId: event.chat.id,
                eventId: event.id,
                status: 'COMPLETED',
              });
          } catch (e) {
            this.logger.error(
              `Failed to notify chat for event ${event.id}: ${e.message}`,
            );
          }
        }

        if (participantIds.length > 0) {
          const socketPayload = {
            type: 'EVENT_EXPIRED',
            eventId: event.id,
            eventName: event.eventName,
            chatId: event.chat?.id ?? null,
            timestamp: now.toISOString(),
          };
          const pushPayload = {
            type: PushType.EVENT_EXPIRED,
            eventId: event.id,
            eventName: event.eventName,
            chatId: event.chat?.id,
            timestamp: now.toISOString(),
          };

          await this.notificationDispatcher.notifyUsers(
            participantIds,
            socketPayload,
            pushPayload,
            {
              ...PUSH_POLICY[PushType.EVENT_EXPIRED],
              dedupeKey: `event_expired:${event.id}`,
            },
          );
        }

        this.logger.log(`Event completed: ${event.id} (${event.eventName})`);
      }
    } catch (error) {
      this.logger.error(`Expiration error: ${error.message}`, error.stack);
    } finally {
      this.isExpiring = false;
    }
  }

  /**
   * Каждую минуту: COMPLETED → FINALIZED через 2 часа после endTime.
   * Обрабатывает карму: confirmed → награда, joined (no-show) → штраф, left → ничего.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleFinalizeEvents() {
    if (this.isFinalizing) return;
    this.isFinalizing = true;

    try {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - TWO_HOURS_MS);

      const eventsToFinalize = await this.prisma.event.findMany({
        where: {
          status: EventStatus.COMPLETED,
          isActive: true,
          OR: [
            { endTime: { not: null, lt: twoHoursAgo } },
            {
              isAllDay: true,
              endTime: null,
              date: { lt: startOfDayUtc(twoHoursAgo) },
            },
            { isAllDay: false, endTime: null, date: { lt: twoHoursAgo } },
          ],
        },
        select: {
          id: true,
          eventName: true,
          creatorId: true,
          chat: { select: { id: true } },
          attendances: {
            select: { id: true, userId: true, status: true },
          },
        },
      });

      if (eventsToFinalize.length === 0) return;

      this.logger.log(`Finalizing ${eventsToFinalize.length} event(s)...`);

      for (const event of eventsToFinalize) {
        await this.finalizeEvent(event, now);
      }
    } catch (error) {
      this.logger.error(`Finalization error: ${error.message}`, error.stack);
    } finally {
      this.isFinalizing = false;
    }
  }

  private async finalizeEvent(
    event: {
      id: string;
      eventName: string;
      creatorId: string;
      chat: { id: string } | null;
      attendances: { id: string; userId: string; status: AttendanceStatus }[];
    },
    now: Date,
  ) {
    const confirmed = event.attendances.filter(
      (a) =>
        a.userId !== event.creatorId &&
        a.status === AttendanceStatus.CONFIRMED,
    );
    const noShows = event.attendances.filter(
      (a) =>
        a.userId !== event.creatorId &&
        a.status === AttendanceStatus.JOINED,
    );

    const organizerMarkedNobody =
      confirmed.length === 0 && noShows.length > 0;

    if (noShows.length > 0) {
      const noShowUserIds = noShows.map((a) => a.userId);
      const users = await this.prisma.user.findMany({
        where: { id: { in: noShowUserIds } },
        select: { id: true, rating: true, totalAttended: true },
      });
      const userById = new Map(users.map((u) => [u.id, u]));

      if (organizerMarkedNobody) {
        const graceRows: Array<{
          userId: string;
          newRating: number;
          newTotalAttended: number;
        }> = [];
        for (const att of noShows) {
          const u = userById.get(att.userId);
          if (!u) continue;
          graceRows.push({
            userId: att.userId,
            newRating: applyKarmaDelta(u.rating, KARMA_DELTA_ATTEND),
            newTotalAttended: u.totalAttended + 1,
          });
        }
        if (graceRows.length > 0) {
          await this.prisma.$transaction(
            graceRows.map((row) =>
              this.prisma.user.update({
                where: { id: row.userId },
                data: {
                  rating: row.newRating,
                  totalAttended: row.newTotalAttended,
                },
              }),
            ),
          );
          await this.notifyGuestsInChunks(
            graceRows.map((row) => {
              const rewardSocket = {
                type: PushType.ATTENDANCE_REWARD,
                eventId: event.id,
                eventName: event.eventName,
                newRating: row.newRating,
                totalAttended: row.newTotalAttended,
                timestamp: now.toISOString(),
                title: 'Присутствие зачтено',
                body: `+${KARMA_DELTA_ATTEND} к карме за «${event.eventName}» (организатор не отметил гостей)`,
              };
              const rewardPush: PushPayload = {
                type: PushType.ATTENDANCE_REWARD,
                eventId: event.id,
                eventName: event.eventName,
                newRating: String(row.newRating),
                totalAttended: String(row.newTotalAttended),
                timestamp: rewardSocket.timestamp,
                title: rewardSocket.title,
                body: rewardSocket.body,
              };
              return {
                userId: row.userId,
                socket: rewardSocket,
                push: rewardPush,
                pushType: PushType.ATTENDANCE_REWARD,
                dedupeKey: `attendance_reward_grace:${event.id}:${row.userId}:${uuidv7()}`,
              };
            }),
          );
        }
      } else {
        const penaltyRows: Array<{
          userId: string;
          oldRating: number;
          newRating: number;
        }> = [];
        for (const att of noShows) {
          const u = userById.get(att.userId);
          if (!u) continue;
          penaltyRows.push({
            userId: att.userId,
            oldRating: u.rating,
            newRating: applyKarmaDelta(u.rating, -KARMA_NO_SHOW_PENALTY),
          });
        }
        if (penaltyRows.length > 0) {
          await this.prisma.$transaction(
            penaltyRows.map((row) =>
              this.prisma.user.update({
                where: { id: row.userId },
                data: { rating: row.newRating },
              }),
            ),
          );
          await this.notifyGuestsInChunks(
            penaltyRows.map((row) => {
              const penaltySocket = {
                type: PushType.NO_SHOW_PENALTY,
                eventId: event.id,
                eventName: event.eventName,
                penalty: KARMA_NO_SHOW_PENALTY,
                oldRating: row.oldRating,
                newRating: row.newRating,
                timestamp: now.toISOString(),
                title: 'Вы не отметились на ивенте',
                body: `−${KARMA_NO_SHOW_PENALTY} к карме за «${event.eventName}»`,
              };
              const penaltyPush: PushPayload = {
                type: PushType.NO_SHOW_PENALTY,
                eventId: event.id,
                eventName: event.eventName,
                penalty: String(KARMA_NO_SHOW_PENALTY),
                oldRating: String(row.oldRating),
                newRating: String(row.newRating),
                timestamp: penaltySocket.timestamp,
                title: penaltySocket.title,
                body: penaltySocket.body,
              };
              return {
                userId: row.userId,
                socket: penaltySocket,
                push: penaltyPush,
                pushType: PushType.NO_SHOW_PENALTY,
                dedupeKey: `no_show:${event.id}:${row.userId}`,
              };
            }),
          );
        }
      }
    }

    if (organizerMarkedNobody) {
      const reminderSocket = {
        type: PushType.ORGANIZER_ATTENDANCE_REMINDER,
        eventId: event.id,
        eventName: event.eventName,
        timestamp: now.toISOString(),
        title: 'Отметьте участников',
        body:
          `Вы не отметили присутствие на «${event.eventName}». ` +
          'Чтобы повысить доверие в приложении, постарайтесь отмечать тех, кто пришёл.',
      };
      const reminderPush: PushPayload = {
        type: PushType.ORGANIZER_ATTENDANCE_REMINDER,
        eventId: event.id,
        eventName: event.eventName,
        timestamp: reminderSocket.timestamp,
        title: reminderSocket.title,
        body: reminderSocket.body,
      };
      void this.notificationDispatcher
        .notifyUser(event.creatorId, reminderSocket, reminderPush, {
          ...PUSH_POLICY[PushType.ORGANIZER_ATTENDANCE_REMINDER],
          dedupeKey: `organizer_attendance_reminder:${event.id}`,
        })
        .catch((e: Error) => {
          this.logger.error(
            `ORGANIZER_ATTENDANCE_REMINDER notify failed user=${event.creatorId}: ${e.message}`,
          );
        });
    }

    const organizer = await this.prisma.user.findUnique({
      where: { id: event.creatorId },
      select: { rating: true },
    });
    if (organizer) {
      const oldOrgRating = organizer.rating;
      const newOrgRating = applyKarmaDelta(organizer.rating, KARMA_DELTA_ATTEND);
      await this.prisma.user.update({
        where: { id: event.creatorId },
        data: { rating: newOrgRating },
      });

      const hostSocket = {
        type: PushType.ORGANIZER_HOST_KARMA,
        eventId: event.id,
        eventName: event.eventName,
        oldRating: oldOrgRating,
        newRating: newOrgRating,
        timestamp: now.toISOString(),
        title: 'Ивент завершён',
        body: `+${KARMA_DELTA_ATTEND} к карме за проведение «${event.eventName}»`,
      };
      const hostPush: PushPayload = {
        type: PushType.ORGANIZER_HOST_KARMA,
        eventId: event.id,
        eventName: event.eventName,
        oldRating: String(oldOrgRating),
        newRating: String(newOrgRating),
        timestamp: hostSocket.timestamp,
        title: hostSocket.title,
        body: hostSocket.body,
      };

      void this.notificationDispatcher
        .notifyUser(event.creatorId, hostSocket, hostPush, {
          ...PUSH_POLICY[PushType.ORGANIZER_HOST_KARMA],
          dedupeKey: `organizer_host:${event.id}`,
        })
        .catch((e: Error) => {
          this.logger.error(
            `ORGANIZER_HOST_KARMA notify failed user=${event.creatorId}: ${e.message}`,
          );
        });

      this.notificationDispatcher.notifyProfileKarmaRefetch(event.creatorId);
    }

    await this.prisma.event.update({
      where: { id: event.id },
      data: { status: EventStatus.FINALIZED },
    });

    if (event.chat) {
      try {
        const systemUserId = event.creatorId;
        const confirmedCount = confirmed.length;
        const noShowCount = noShows.length;
        const summaryMessage = organizerMarkedNobody
          ? 'Итоги события: организатор не отметил присутствие. Участникам зачтено посещение (+карма).'
          : `Итоги события: ${confirmedCount} подтверждено, ${noShowCount} не явилось.`;

        await this.chatGateway.broadcastSystemMessage(
          event.chat.id,
          systemUserId,
          summaryMessage,
        );

        this.chatGateway.server
          .to(`chat:${event.chat.id}`)
          .emit('eventFinalized', {
            eventId: event.id,
            chatId: event.chat.id,
            confirmedCount,
            noShowCount,
          });
      } catch (e) {
        this.logger.error(
          `Finalize notify failed for ${event.id}: ${e.message}`,
        );
      }
    }

    const allUserIds = event.attendances
      .filter((a) => a.status !== AttendanceStatus.LEFT)
      .map((a) => a.userId);

    const existingRatings =
      allUserIds.length > 0
        ? await this.prisma.organizerRating.findMany({
            where: { eventId: event.id, raterId: { in: allUserIds } },
            select: { raterId: true },
          })
        : [];
    const ratedUserIds = new Set(existingRatings.map((r) => r.raterId));

    for (const userId of allUserIds) {
      const att = event.attendances.find((a) => a.userId === userId);
      const { canRateOrganizer } = organizerRatingViewerState({
        viewerId: userId,
        organizerId: event.creatorId,
        eventStatus: EventStatus.FINALIZED,
        attendanceStatus: att?.status,
        hasExistingRating: ratedUserIds.has(userId),
      });

      const finalizedSocket = {
        type: PushType.EVENT_FINALIZED,
        eventId: event.id,
        eventName: event.eventName,
        chatId: event.chat?.id,
        timestamp: now.toISOString(),
        canRateOrganizer,
        title: 'Событие завершено',
        body: canRateOrganizer
          ? `Оцените организатора: «${event.eventName}»`
          : `Итоги: «${event.eventName}»`,
      };
      const finalizedPush: PushPayload = {
        type: PushType.EVENT_FINALIZED,
        eventId: event.id,
        eventName: event.eventName,
        chatId: event.chat?.id,
        timestamp: finalizedSocket.timestamp,
        canRateOrganizer: String(canRateOrganizer),
        title: finalizedSocket.title,
        body: finalizedSocket.body,
      };

      void this.notificationDispatcher
        .notifyUser(userId, finalizedSocket, finalizedPush, {
          ...PUSH_POLICY[PushType.EVENT_FINALIZED],
          dedupeKey: `event_finalized:${event.id}:${userId}`,
        })
        .catch((e: Error) => {
          this.logger.error(
            `EVENT_FINALIZED notify failed user=${userId}: ${e.message}`,
          );
        });
    }

    this.logger.log(
      `Event finalized: ${event.id} (${event.eventName}) — confirmed=${confirmed.length}, joinedUnmarked=${noShows.length}, organizerMarkedNobody=${organizerMarkedNobody}`,
    );
  }

  private async notifyGuestsInChunks(
    items: Array<{
      userId: string;
      socket: Record<string, unknown>;
      push: PushPayload;
      pushType: PushType;
      dedupeKey: string;
    }>,
  ): Promise<void> {
    for (let i = 0; i < items.length; i += NOTIFY_CHUNK_SIZE) {
      const chunk = items.slice(i, i + NOTIFY_CHUNK_SIZE);
      const results = await Promise.allSettled(
        chunk.map((item) =>
          this.notificationDispatcher.notifyUser(
            item.userId,
            item.socket,
            item.push,
            {
              ...PUSH_POLICY[item.pushType],
              dedupeKey: item.dedupeKey,
            },
          ),
        ),
      );
      for (let j = 0; j < results.length; j++) {
        const settled = results[j];
        if (settled.status === 'rejected') {
          const msg =
            settled.reason instanceof Error
              ? settled.reason.message
              : String(settled.reason);
          this.logger.error(
            `Guest notify failed user=${chunk[j].userId}: ${msg}`,
          );
        }
        this.notificationDispatcher.notifyProfileKarmaRefetch(
          chunk[j].userId,
        );
      }
    }
  }
}
