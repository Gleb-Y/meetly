import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { QueryEventsDto } from './dto/query-events.dto';
import { ChatService } from 'src/chat/chat.service';
import { ChatGateway } from 'src/chat/chat.gateway';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import {
  EventCategory,
  EventVisibility,
  EventJoinRequestStatus,
  EventStatus,
  AttendanceStatus,
  Prisma,
} from '@prisma/client';
import { PUSH_POLICY, PushPayload, PushType } from '../notifications/push.types';
import { v7 as uuidv7 } from 'uuid';
import { organizerRatingViewerState } from './organizer-rating.helpers';
import {
  DEFAULT_ORGANIZER_CHECK_IN_EARLY_MINUTES,
  EVENT_INSTANT_REQUIRES_TZ_MESSAGE,
  getEffectiveEndAt,
  getEffectiveStartAt,
  getOrganizerMarkAttendanceUi,
  parseEventInstantOrThrow,
} from './event-time.helpers';
import {
  applyKarmaDelta,
  KARMA_DELTA_ATTEND,
} from './karma.constants';

const CREATOR_SELECT = {
  id: true,
  username: true,
  avatar: true,
  phoneNumber: true,
} as const;

const PARTICIPANT_INCLUDE = {
  user: {
    select: {
      id: true,
      username: true,
      avatar: true,
    },
  },
} as const;

const buildEventInclude = (includeChat: boolean) =>
  ({
    creator: { select: CREATOR_SELECT },
    participants: { include: PARTICIPANT_INCLUDE },
    ...(includeChat && { chat: { select: { id: true } } }),
    _count: { select: { participants: true } },
  }) as const;

type EventWithIncludes = Prisma.EventGetPayload<{
  include: ReturnType<typeof buildEventInclude>;
}>;

@Injectable()
export class EventsService {
  private static readonly MAX_EVENT_PHOTOS = 10;
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly notificationDispatcher: NotificationDispatcherService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly configService: ConfigService,
  ) {}

  private organizerCheckInEarlyMinutes(): number {
    const raw = this.configService.get<string>(
      'ORGANIZER_CHECK_IN_EARLY_MINUTES',
    );
    const n = raw != null && raw !== '' ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n >= 0
      ? n
      : DEFAULT_ORGANIZER_CHECK_IN_EARLY_MINUTES;
  }

  private parseEventInstantField(value: string, fieldName: string): Date {
    try {
      return parseEventInstantOrThrow(value);
    } catch {
      throw new BadRequestException(
        `${fieldName}: ${EVENT_INSTANT_REQUIRES_TZ_MESSAGE}`,
      );
    }
  }

  private assertEndAfterStartWhenBothPresent(
    isAllDay: boolean,
    start: Date | null,
    end: Date | null,
  ) {
    if (isAllDay || !start || !end) return;
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('endTime must be after startTime');
    }
  }

  async create(createEventDto: CreateEventDto, userId: string) {
    this.logger.log(`🎉 Creating event for user ${userId}`);

    const { date, startTime, endTime, photoUrl, photoUrls, ...rest } =
      createEventDto;
    const normalizedPhotoUrls = this.normalizeEventPhotoUrls(
      photoUrls,
      photoUrl,
    );

    if (rest.category === EventCategory.custom) {
      const name = rest.customCategoryName?.trim();
      if (!name || name.length < 1 || name.length > 12 || /\s/.test(name)) {
        throw new BadRequestException(
          'customCategoryName is required when category is custom (1-12 characters, single word)',
        );
      }
    }

    let parsedStart: Date | null = null;
    let parsedEnd: Date | null = null;
    if (startTime != null && startTime !== '') {
      parsedStart = this.parseEventInstantField(startTime, 'startTime');
    }
    if (endTime != null && endTime !== '') {
      parsedEnd = this.parseEventInstantField(endTime, 'endTime');
    }
    this.assertEndAfterStartWhenBothPresent(
      rest.isAllDay,
      parsedStart,
      parsedEnd,
    );

    const event = await this.prisma.event.create({
      data: {
        ...rest,
        photoUrls: normalizedPhotoUrls,
        photoUrl: normalizedPhotoUrls[0] ?? null,
        date: new Date(date),
        startTime: parsedStart,
        endTime: parsedEnd,
        creatorId: userId,
        customCategoryName:
          rest.category === EventCategory.custom
            ? (rest.customCategoryName ?? null)
            : null,
        customCategoryIconUrl:
          rest.category === EventCategory.custom
            ? (rest.customCategoryIconUrl ?? null)
            : null,
      },
      select: { id: true },
    });

    this.logger.log(`✅ Event created with ID: ${event.id}`);

    const [chat] = await Promise.all([
      this.chatService.createChatForEvent(event.id),
      this.prisma.eventParticipant.create({
        data: { eventId: event.id, userId },
      }),
    ]);

    this.logger.log(
      `✅ Chat created with ID: ${chat.id}, creator added as participant`,
    );

    try {
      await this.chatGateway.broadcastSystemMessage(
        chat.id,
        userId,
        'Событие создано!',
      );
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `System message failed (event created): ${err.message}`,
        err.stack,
      );
    }

    this.sendProfileEventsUpdated(userId);

    const friends = await this.prisma.friendship.findMany({
      where: { userId },
      select: { friendId: true },
    });
    const friendIds = friends
      .map((f) => f.friendId)
      .filter((id) => id !== userId);

    if (friendIds.length > 0) {
      const notificationId = uuidv7();
      const payload = {
        type: PushType.FRIEND_EVENT_CREATED,
        notificationId,
        eventId: event.id,
        eventName: createEventDto.eventName,
        eventType: createEventDto.category,
        participantCount: '1',
        title: 'New event from friend',
        body: createEventDto.eventName,
      };

      void this.notificationDispatcher
        .notifyUsers(friendIds, payload, payload, {
          ...PUSH_POLICY[PushType.FRIEND_EVENT_CREATED],
          dedupeKey: `event_created:${event.id}`,
        })
        .catch((error: Error) => {
          this.logger.error(
            `FRIEND_EVENT_CREATED push failed event=${event.id}: ${error.message}`,
          );
        });
    }

    if (createEventDto.visibility === EventVisibility.PUBLIC) {
      this.notificationsGateway.broadcastNotification('notification', {
        type: 'EVENTS_MAP_STALE',
        eventId: event.id,
        timestamp: new Date().toISOString(),
      });
    }

    return this.getEventById(event.id, userId);
  }

  async findAll(queryDto: QueryEventsDto, userId?: string) {
    const { category, visibility, latitude, longitude, radius } = queryDto;

    const now = new Date();
    const where: Prisma.EventWhereInput = {
      isActive: true,
      status: EventStatus.ACTIVE,
      creator: {
        OR: [{ bannedUntil: null }, { bannedUntil: { lte: now } }],
      },
      ...(category && { category }),
      ...(visibility && { visibility }),
      ...(userId && { kicks: { none: { userId } } }),
    };

    const events = await this.prisma.event.findMany({
      where,
      include: buildEventInclude(!!userId),
      orderBy: { createdAt: 'desc' },
    });

    let joinRequestMap = new Map<string, EventJoinRequestStatus>();
    if (userId) {
      const eventIds = events
        .filter((e) => e.visibility === EventVisibility.PRIVATE)
        .map((e) => e.id);
      if (eventIds.length > 0) {
        const requests = await this.prisma.eventJoinRequest.findMany({
          where: { userId, eventId: { in: eventIds } },
          select: { eventId: true, status: true },
        });
        joinRequestMap = new Map(requests.map((r) => [r.eventId, r.status]));
      }
    }

    const mappedEvents = events.map((event) => ({
      ...this.mapEvent(event, userId),
      joinRequestStatus: joinRequestMap.get(event.id) ?? null,
    }));

    if (latitude != null && longitude != null && radius != null) {
      return mappedEvents.filter((event) => {
        const distance = this.calculateDistance(
          latitude,
          longitude,
          event.locationLatitude,
          event.locationLongitude,
        );
        return distance <= radius;
      });
    }

    return mappedEvents;
  }

  async getEventById(id: string, userId?: string) {
    const now = new Date();
    const event = await this.prisma.event.findFirst({
      where: {
        id,
        creator: {
          OR: [{ bannedUntil: null }, { bannedUntil: { lte: now } }],
        },
      },
      include: buildEventInclude(!!userId),
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (userId) {
      const kicked = await this.prisma.eventKick.findUnique({
        where: { eventId_userId: { eventId: id, userId } },
      });
      if (kicked) throw new NotFoundException('Event not found');
    }

    let joinRequestStatus: EventJoinRequestStatus | null = null;
    if (
      userId &&
      event.visibility === EventVisibility.PRIVATE &&
      event.creatorId !== userId &&
      !event.participants.some((p) => p.userId === userId)
    ) {
      const request = await this.prisma.eventJoinRequest.findUnique({
        where: { eventId_userId: { eventId: id, userId } },
        select: { status: true },
      });
      joinRequestStatus = request?.status ?? null;
    }

    const base = { ...this.mapEvent(event, userId), joinRequestStatus };

    if (!userId) {
      return base;
    }

    const ratingFields = await this.getOrganizerRatingViewerFields(
      id,
      userId,
      event.status,
      event.creatorId,
    );

    return { ...base, ...ratingFields };
  }

  async update(id: string, updateEventDto: UpdateEventDto, userId: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });

    if (!event) throw new NotFoundException('Event not found');
    if (event.creatorId !== userId)
      throw new ForbiddenException('Only creator can update event');

    const { date, photoUrl, photoUrls, ...rest } = updateEventDto;
    const categoryInDto = 'category' in updateEventDto;
    const customCategoryNameInDto = 'customCategoryName' in updateEventDto;
    const customCategoryIconUrlInDto =
      'customCategoryIconUrl' in updateEventDto;
    const photoUrlInDto = 'photoUrl' in updateEventDto;
    const photoUrlsInDto = 'photoUrls' in updateEventDto;

    const validateCustomCategoryName = (name: string | undefined) => {
      const trimmed = name?.trim();
      if (
        !trimmed ||
        trimmed.length < 1 ||
        trimmed.length > 12 ||
        /\s/.test(trimmed)
      ) {
        throw new BadRequestException(
          'customCategoryName is required when category is custom (1-12 characters, single word)',
        );
      }
    };

    if (categoryInDto && rest.category === EventCategory.custom) {
      validateCustomCategoryName(rest.customCategoryName);
    } else if (
      !categoryInDto &&
      event.category === EventCategory.custom &&
      customCategoryNameInDto
    ) {
      validateCustomCategoryName(rest.customCategoryName);
    }

    let customCategoryName: string | null | undefined;
    if (categoryInDto) {
      customCategoryName =
        rest.category === EventCategory.custom
          ? (rest.customCategoryName ?? null)
          : null;
    } else {
      customCategoryName =
        event.category === EventCategory.custom
          ? ((rest.customCategoryName !== undefined
              ? rest.customCategoryName
              : event.customCategoryName) ?? null)
          : undefined;
    }

    let customCategoryIconUrl: string | null | undefined;
    if (categoryInDto) {
      customCategoryIconUrl =
        rest.category === EventCategory.custom
          ? (rest.customCategoryIconUrl ?? null)
          : null;
    } else {
      customCategoryIconUrl =
        event.category === EventCategory.custom
          ? customCategoryIconUrlInDto
            ? (rest.customCategoryIconUrl ?? null)
            : event.customCategoryIconUrl
          : undefined;
    }

    const data: Prisma.EventUpdateInput = {
      ...rest,
      ...(date && { date: new Date(date) }),
      ...(customCategoryName !== undefined && { customCategoryName }),
      ...(customCategoryIconUrl !== undefined && {
        customCategoryIconUrl,
      }),
    };

    const nextIsAllDay =
      'isAllDay' in updateEventDto && updateEventDto.isAllDay !== undefined
        ? updateEventDto.isAllDay
        : event.isAllDay;

    let nextStart = event.startTime;
    if ('startTime' in updateEventDto) {
      const st = updateEventDto.startTime;
      if (st == null || st === '') {
        nextStart = null;
        data.startTime = null;
      } else {
        nextStart = this.parseEventInstantField(st, 'startTime');
        data.startTime = nextStart;
      }
    }

    let nextEnd = event.endTime;
    if ('endTime' in updateEventDto) {
      const et = updateEventDto.endTime;
      if (et == null || et === '') {
        nextEnd = null;
        data.endTime = null;
      } else {
        nextEnd = this.parseEventInstantField(et, 'endTime');
        data.endTime = nextEnd;
      }
    }

    this.assertEndAfterStartWhenBothPresent(nextIsAllDay, nextStart, nextEnd);

    if (photoUrlInDto || photoUrlsInDto) {
      const normalizedPhotoUrls = photoUrlsInDto
        ? this.normalizeEventPhotoUrls(photoUrls ?? [], photoUrl)
        : this.normalizeEventPhotoUrls(undefined, photoUrl);
      data.photoUrls = normalizedPhotoUrls;
      data.photoUrl = normalizedPhotoUrls[0] ?? null;
    }

    return this.prisma.event.update({
      where: { id },
      data,
      include: buildEventInclude(false),
    });
  }

  async delete(id: string, userId: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });

    if (!event) throw new NotFoundException('Event not found');
    if (event.creatorId !== userId)
      throw new ForbiddenException('Only creator can delete event');

    await this.prisma.event.delete({ where: { id } });

    this.sendProfileEventsUpdated(userId);

    return { message: 'Event deleted successfully' };
  }

  async joinEvent(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        _count: { select: { participants: true } },
        chat: { select: { id: true } },
        creator: { select: { id: true, username: true, avatar: true } },
      },
    });

    if (!event) throw new NotFoundException('Event not found');
    if (!event.isActive) throw new BadRequestException('Event is not active');
    if (event.status === EventStatus.COMPLETED)
      throw new BadRequestException('Event has already ended');
    if (event.creatorId === userId)
      throw new BadRequestException('You are the creator of this event');

    const kicked = await this.prisma.eventKick.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (kicked)
      throw new ForbiddenException('You have been removed from this event');

    if (event._count.participants >= event.maxParticipants) {
      throw new BadRequestException('Event is full');
    }

    const existingParticipant = await this.prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (existingParticipant)
      throw new BadRequestException('Already joined this event');

    if (event.visibility === EventVisibility.PRIVATE) {
      return this.createJoinRequest(event, userId);
    }

    await Promise.all([
      this.prisma.eventParticipant.create({ data: { eventId, userId } }),
      this.prisma.attendance.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: { eventId, userId, status: AttendanceStatus.JOINED },
        update: { status: AttendanceStatus.JOINED },
      }),
      !event.chat && this.chatService.createChatForEvent(eventId),
    ]);

    const chat = await this.prisma.chat.findUnique({
      where: { eventId },
      select: { id: true },
    });
    if (chat) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });
      try {
        await this.chatGateway.broadcastSystemMessage(
          chat.id,
          userId,
          `${user?.username ?? 'Участник'} присоединился к событию`,
        );
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        this.logger.error(
          `System message failed (join): ${err.message}`,
          err.stack,
        );
      }
    }

    this.sendProfileEventsUpdated(userId);

    return {
      ...(await this.getEventById(eventId, userId)),
      message: 'Successfully joined event',
    };
  }

  private async createJoinRequest(
    event: { id: string; eventName: string; creatorId: string },
    userId: string,
  ) {
    const existing = await this.prisma.eventJoinRequest.findUnique({
      where: { eventId_userId: { eventId: event.id, userId } },
    });

    if (existing?.status === EventJoinRequestStatus.PENDING) {
      throw new ConflictException('Join request already sent');
    }
    if (existing?.status === EventJoinRequestStatus.ACCEPTED) {
      throw new ConflictException('You are already accepted');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, username: true, avatar: true },
    });

    const joinRequest = existing
      ? await this.prisma.eventJoinRequest.update({
          where: { id: existing.id },
          data: { status: EventJoinRequestStatus.PENDING },
        })
      : await this.prisma.eventJoinRequest.create({
          data: { eventId: event.id, userId },
        });

    this.notificationsGateway.sendToUser(event.creatorId, 'notification', {
      type: 'EVENT_JOIN_REQUEST',
      requestId: joinRequest.id,
      eventId: event.id,
      eventName: event.eventName,
      userId: user.id,
      username: user.username,
      avatar: user.avatar,
      timestamp: joinRequest.createdAt.toISOString(),
    });

    this.logger.log(
      `Join request created: user=${userId} -> event=${event.id}`,
    );

    return {
      message: 'Join request sent to event creator',
      joinRequestId: joinRequest.id,
      joinRequestStatus: EventJoinRequestStatus.PENDING,
    };
  }

  async respondToJoinRequest(
    requestId: string,
    creatorId: string,
    action: 'accept' | 'reject',
  ) {
    const request = await this.prisma.eventJoinRequest.findUnique({
      where: { id: requestId },
      include: {
        event: {
          include: {
            _count: { select: { participants: true } },
            chat: { select: { id: true } },
          },
        },
        user: { select: { id: true, username: true, avatar: true } },
      },
    });

    if (!request) throw new NotFoundException('Join request not found');
    if (request.event.creatorId !== creatorId)
      throw new ForbiddenException('Only event creator can respond');
    if (request.status !== EventJoinRequestStatus.PENDING)
      throw new BadRequestException('Request already processed');

    if (action === 'reject') {
      const updated = await this.prisma.eventJoinRequest.update({
        where: { id: requestId },
        data: { status: EventJoinRequestStatus.REJECTED },
      });

      this.notificationsGateway.sendToUser(request.userId, 'notification', {
        type: 'EVENT_JOIN_REQUEST_REJECTED',
        requestId: updated.id,
        eventId: request.eventId,
        eventName: request.event.eventName,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(
        `Join request rejected: ${requestId} (event=${request.eventId})`,
      );
      return { success: true, status: 'rejected' };
    }

    if (request.event._count.participants >= request.event.maxParticipants) {
      throw new BadRequestException('Event is full');
    }

    await this.prisma.$transaction([
      this.prisma.eventJoinRequest.update({
        where: { id: requestId },
        data: { status: EventJoinRequestStatus.ACCEPTED },
      }),
      this.prisma.eventParticipant.create({
        data: { eventId: request.eventId, userId: request.userId },
      }),
      this.prisma.attendance.upsert({
        where: {
          eventId_userId: { eventId: request.eventId, userId: request.userId },
        },
        create: {
          eventId: request.eventId,
          userId: request.userId,
          status: AttendanceStatus.JOINED,
        },
        update: { status: AttendanceStatus.JOINED },
      }),
    ]);

    if (!request.event.chat) {
      await this.chatService.createChatForEvent(request.eventId);
    }

    const chat = await this.prisma.chat.findUnique({
      where: { eventId: request.eventId },
      select: { id: true },
    });

    this.notificationsGateway.sendToUser(request.userId, 'notification', {
      type: 'EVENT_JOIN_REQUEST_ACCEPTED',
      requestId: request.id,
      eventId: request.eventId,
      eventName: request.event.eventName,
      chatId: chat?.id ?? null,
      timestamp: new Date().toISOString(),
    });

    this.sendProfileEventsUpdated(request.userId);

    if (chat) {
      try {
        await this.chatGateway.broadcastSystemMessage(
          chat.id,
          request.userId,
          `${request.user.username ?? 'Участник'} присоединился к событию`,
        );
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        this.logger.error(
          `System message failed (accept): ${err.message}`,
          err.stack,
        );
      }
    }

    this.logger.log(
      `Join request accepted: user=${request.userId} -> event=${request.eventId}`,
    );

    return {
      success: true,
      status: 'accepted',
      userId: request.userId,
      user: request.user,
    };
  }

  async getEventJoinRequests(eventId: string, creatorId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { creatorId: true },
    });

    if (!event) throw new NotFoundException('Event not found');
    if (event.creatorId !== creatorId)
      throw new ForbiddenException('Only event creator can view join requests');

    return this.prisma.eventJoinRequest.findMany({
      where: { eventId, status: EventJoinRequestStatus.PENDING },
      include: {
        user: {
          select: { id: true, username: true, avatar: true, bio: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelJoinRequest(requestId: string, userId: string) {
    const request = await this.prisma.eventJoinRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundException('Join request not found');
    if (request.userId !== userId)
      throw new ForbiddenException('Only requester can cancel');
    if (request.status !== EventJoinRequestStatus.PENDING)
      throw new BadRequestException('Request already processed');

    await this.prisma.eventJoinRequest.delete({ where: { id: requestId } });

    return { success: true };
  }

  async kickParticipant(
    eventId: string,
    creatorId: string,
    targetUserId: string,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { chat: { select: { id: true } } },
    });

    if (!event) throw new NotFoundException('Event not found');
    if (event.creatorId !== creatorId)
      throw new ForbiddenException('Only event creator can kick participants');
    if (targetUserId === creatorId)
      throw new BadRequestException('Cannot kick yourself');

    const participant = await this.prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId, userId: targetUserId } },
    });
    if (!participant)
      throw new BadRequestException('User is not a participant');

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { username: true },
    });

    await this.prisma.$transaction([
      this.prisma.eventParticipant.delete({
        where: { eventId_userId: { eventId, userId: targetUserId } },
      }),
      this.prisma.eventKick.create({
        data: { eventId, userId: targetUserId },
      }),
      this.prisma.eventJoinRequest.deleteMany({
        where: { eventId, userId: targetUserId },
      }),
      this.prisma.attendance.upsert({
        where: { eventId_userId: { eventId, userId: targetUserId } },
        create: {
          eventId,
          userId: targetUserId,
          status: AttendanceStatus.LEFT,
        },
        update: { status: AttendanceStatus.LEFT },
      }),
    ]);

    if (event.chat) {
      try {
        await this.chatGateway.broadcastSystemMessage(
          event.chat.id,
          targetUserId,
          `${targetUser?.username ?? 'Участник'} был исключён из события`,
        );
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        this.logger.error(
          `System message failed (kick): ${err.message}`,
          err.stack,
        );
      }
    }

    this.notificationsGateway.sendToUser(targetUserId, 'notification', {
      type: 'EVENT_KICKED',
      eventId,
      eventName: event.eventName,
      timestamp: new Date().toISOString(),
    });

    this.sendProfileEventsUpdated(targetUserId);

    this.logger.log(
      `User kicked: ${targetUserId} from event ${eventId} by ${creatorId}`,
    );

    return { success: true };
  }

  async leaveEvent(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { chat: { select: { id: true } } },
    });

    if (!event) throw new NotFoundException('Event not found');
    if (event.creatorId === userId) {
      throw new BadRequestException('Creator cannot leave their own event');
    }

    const participant = await this.prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (!participant)
      throw new BadRequestException('Not a participant of this event');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    if (event.chat) {
      try {
        await this.chatGateway.broadcastSystemMessage(
          event.chat.id,
          userId,
          `${user?.username ?? 'Участник'} покинул событие`,
        );
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        this.logger.error(
          `System message failed (leave): ${err.message}`,
          err.stack,
        );
      }
    }

    const now = new Date();
    const eventStartTime = event.startTime ?? event.date;
    const isBeforeStart = now < eventStartTime;

    await Promise.all([
      this.prisma.eventParticipant.delete({
        where: { eventId_userId: { eventId, userId } },
      }),
      this.prisma.attendance.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: { eventId, userId, status: AttendanceStatus.LEFT },
        update: {
          status: isBeforeStart
            ? AttendanceStatus.LEFT
            : AttendanceStatus.JOINED,
        },
      }),
    ]);

    this.sendProfileEventsUpdated(userId);

    return { message: 'Left event successfully' };
  }

  async getMyEvents(userId: string) {
    const now = new Date();
    const events = await this.prisma.event.findMany({
      where: {
        isActive: true,
        kicks: { none: { userId } },
        OR: [{ creatorId: userId }, { participants: { some: { userId } } }],
        creator: {
          OR: [{ bannedUntil: null }, { bannedUntil: { lte: now } }],
        },
      },
      include: buildEventInclude(true),
      orderBy: { date: 'desc' },
    });

    const ratingMap = await this.batchOrganizerRatingViewerFields(
      userId,
      events.map((e) => ({
        id: e.id,
        status: e.status,
        creatorId: e.creatorId,
      })),
    );

    const mapped = events.map((event) => ({
      ...this.mapEvent(event, userId),
      ...(ratingMap.get(event.id) ?? {
        hasRatedOrganizer: false,
        canRateOrganizer: false,
      }),
      isCreator: event.creatorId === userId,
      status: event.status,
    }));

    return {
      active: mapped.filter((e) => e.status === EventStatus.ACTIVE),
      past: mapped.filter(
        (e) =>
          e.status === EventStatus.COMPLETED ||
          e.status === EventStatus.FINALIZED,
      ),
    };
  }

  async getEventParticipants(
    eventId: string,
    userId?: string,
    forOrganizerCheckIn = false,
  ) {
    const now = new Date();
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        creator: {
          OR: [{ bannedUntil: null }, { bannedUntil: { lte: now } }],
        },
      },
      select: {
        id: true,
        visibility: true,
        creatorId: true,
        maxParticipants: true,
        participants: {
          include: PARTICIPANT_INCLUDE,
          orderBy: { joinedAt: 'asc' },
        },
        _count: { select: { participants: true } },
      },
    });

    if (!event) throw new NotFoundException('Event not found');

    if (
      event.visibility === EventVisibility.PRIVATE &&
      !(
        userId &&
        (event.creatorId === userId ||
          event.participants.some((p) => p.userId === userId))
      )
    ) {
      return {
        eventId: event.id,
        participantsCount: event._count.participants,
        maxParticipants: event.maxParticipants,
        isFull: event._count.participants >= event.maxParticipants,
        participants: [],
      };
    }

    const rawParticipants = event.participants.map((p) => ({
      ...p.user,
      joinedAt: p.joinedAt,
      isCreator: p.userId === event.creatorId,
    }));

    const participants =
      forOrganizerCheckIn && userId === event.creatorId
        ? rawParticipants.filter((p) => p.id !== event.creatorId)
        : rawParticipants;

    return {
      eventId: event.id,
      participantsCount: event._count.participants,
      maxParticipants: event.maxParticipants,
      isFull: event._count.participants >= event.maxParticipants,
      participants,
    };
  }

  private async getOrganizerRatingViewerFields(
    eventId: string,
    userId: string,
    eventStatus: EventStatus,
    creatorId: string,
  ): Promise<{ hasRatedOrganizer: boolean; canRateOrganizer: boolean }> {
    const [attendance, rating] = await Promise.all([
      this.prisma.attendance.findUnique({
        where: { eventId_userId: { eventId, userId } },
        select: { status: true },
      }),
      this.prisma.organizerRating.findUnique({
        where: { eventId_raterId: { eventId, raterId: userId } },
        select: { id: true },
      }),
    ]);

    return organizerRatingViewerState({
      viewerId: userId,
      organizerId: creatorId,
      eventStatus,
      attendanceStatus: attendance?.status,
      hasExistingRating: !!rating,
    });
  }

  private async batchOrganizerRatingViewerFields(
    userId: string,
    events: Array<{ id: string; status: EventStatus; creatorId: string }>,
  ): Promise<
    Map<string, { hasRatedOrganizer: boolean; canRateOrganizer: boolean }>
  > {
    const map = new Map<
      string,
      { hasRatedOrganizer: boolean; canRateOrganizer: boolean }
    >();
    if (events.length === 0) return map;

    const eventIds = events.map((e) => e.id);

    const [attendances, ratings] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { userId, eventId: { in: eventIds } },
        select: { eventId: true, status: true },
      }),
      this.prisma.organizerRating.findMany({
        where: { raterId: userId, eventId: { in: eventIds } },
        select: { eventId: true },
      }),
    ]);

    const attByEvent = new Map(
      attendances.map((a) => [a.eventId, a.status] as const),
    );
    const ratedEventIds = new Set(ratings.map((r) => r.eventId));

    for (const e of events) {
      map.set(
        e.id,
        organizerRatingViewerState({
          viewerId: userId,
          organizerId: e.creatorId,
          eventStatus: e.status,
          attendanceStatus: attByEvent.get(e.id),
          hasExistingRating: ratedEventIds.has(e.id),
        }),
      );
    }

    return map;
  }

  private mapEvent(
    event: EventWithIncludes,
    userId?: string,
    now: Date = new Date(),
  ) {
    const isUserParticipant = userId
      ? event.participants.some((p) => p.userId === userId)
      : false;

    const showChat =
      isUserParticipant || event.visibility === EventVisibility.PUBLIC;

    const organizerAttendanceUi =
      userId && userId === event.creatorId
        ? getOrganizerMarkAttendanceUi({
            viewerId: userId,
            creatorId: event.creatorId,
            status: event.status,
            date: event.date,
            startTime: event.startTime,
            endTime: event.endTime,
            now,
            earlyMinutes: this.organizerCheckInEarlyMinutes(),
          })
        : undefined;

    return {
      ...event,
      title: event.eventName,
      chatId:
        userId && showChat && 'chat' in event
          ? ((event.chat as { id: string } | null)?.id ?? null)
          : null,
      participantsCount: event._count.participants,
      isUserParticipant,
      status: event.status,
      ...(organizerAttendanceUi && { organizerAttendanceUi }),
    };
  }

  private normalizeEventPhotoUrls(
    photoUrls?: string[] | null,
    photoUrl?: string | null,
  ): string[] {
    const normalized = [...(photoUrls ?? [])];
    if (photoUrl) normalized.push(photoUrl);

    const deduplicated = Array.from(
      new Set(normalized.map((item) => item.trim()).filter(Boolean)),
    );

    if (deduplicated.length > EventsService.MAX_EVENT_PHOTOS) {
      throw new BadRequestException(
        `Maximum ${EventsService.MAX_EVENT_PHOTOS} photos are allowed per event`,
      );
    }

    return deduplicated;
  }

  async toggleCheckIn(
    eventId: string,
    creatorId: string,
    targetUserId: string,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        creatorId: true,
        status: true,
        endTime: true,
        date: true,
        startTime: true,
        eventName: true,
        chat: { select: { id: true } },
      },
    });

    if (!event) throw new NotFoundException('Event not found');
    if (event.creatorId !== creatorId)
      throw new ForbiddenException(
        'Only event creator can check in participants',
      );
    if (targetUserId === creatorId)
      throw new BadRequestException('Organizer attendance is implicit');
    if (event.status === EventStatus.FINALIZED)
      throw new BadRequestException('Event has been finalized');

    const now = new Date();
    const eventStart = getEffectiveStartAt(event);
    if (now < eventStart)
      throw new BadRequestException(
        'Check-in is only available after event starts',
      );

    const endAt = getEffectiveEndAt(event);
    const checkInDeadline = new Date(endAt.getTime() + 2 * 60 * 60 * 1000);
    if (now > checkInDeadline)
      throw new BadRequestException(
        'Check-in window has expired (2h after event end)',
      );

    const attendance = await this.prisma.attendance.findUnique({
      where: { eventId_userId: { eventId, userId: targetUserId } },
    });

    if (!attendance || attendance.status === AttendanceStatus.LEFT)
      throw new BadRequestException('User is not an active participant');

    const previousStatus = attendance.status;
    const newStatus =
      attendance.status === AttendanceStatus.CONFIRMED
        ? AttendanceStatus.JOINED
        : AttendanceStatus.CONFIRMED;

    const updated = await this.prisma.attendance.update({
      where: { id: attendance.id },
      data: { status: newStatus },
      include: { user: { select: { id: true, username: true, avatar: true } } },
    });

    if (newStatus === AttendanceStatus.CONFIRMED) {
      const user = await this.prisma.user.findUnique({
        where: { id: targetUserId },
        select: { totalAttended: true, rating: true },
      });
      if (user) {
        const newTotalAttended = user.totalAttended + 1;
        const newRating = applyKarmaDelta(user.rating, KARMA_DELTA_ATTEND);
        await this.prisma.user.update({
          where: { id: targetUserId },
          data: {
            totalAttended: newTotalAttended,
            rating: newRating,
          },
        });

        const rewardSocket = {
          type: PushType.ATTENDANCE_REWARD,
          eventId,
          eventName: event.eventName,
          newRating,
          totalAttended: newTotalAttended,
          timestamp: now.toISOString(),
          title: 'Присутствие подтверждено',
          body: `+${KARMA_DELTA_ATTEND} к карме за «${event.eventName}»`,
        };
        const rewardPush: PushPayload = {
          type: PushType.ATTENDANCE_REWARD,
          eventId,
          eventName: event.eventName,
          newRating: String(newRating),
          totalAttended: String(newTotalAttended),
          timestamp: rewardSocket.timestamp,
          title: rewardSocket.title,
          body: rewardSocket.body,
        };

        void this.notificationDispatcher
          .notifyUser(targetUserId, rewardSocket, rewardPush, {
            ...PUSH_POLICY[PushType.ATTENDANCE_REWARD],
            dedupeKey: `attendance_reward:${eventId}:${targetUserId}:${uuidv7()}`,
          })
          .catch((error: Error) => {
            this.logger.error(
              `ATTENDANCE_REWARD notify failed user=${targetUserId}: ${error.message}`,
            );
          });

        this.notificationDispatcher.notifyProfileKarmaRefetch(targetUserId);
      }
    } else if (previousStatus === AttendanceStatus.CONFIRMED) {
      const user = await this.prisma.user.findUnique({
        where: { id: targetUserId },
        select: { totalAttended: true, rating: true },
      });
      if (user && user.totalAttended > 0) {
        const newTotalAttended = user.totalAttended - 1;
        const newRating = applyKarmaDelta(user.rating, -KARMA_DELTA_ATTEND);
        await this.prisma.user.update({
          where: { id: targetUserId },
          data: {
            totalAttended: newTotalAttended,
            rating: newRating,
          },
        });
      }
      this.notificationDispatcher.notifyProfileKarmaRefetch(targetUserId);
    }

    if (event.chat) {
      this.chatGateway.server
        .to(`chat:${event.chat.id}`)
        .emit('attendanceChanged', {
          eventId,
          userId: targetUserId,
          status: newStatus,
        });
    }

    return {
      success: true,
      userId: targetUserId,
      status: newStatus,
      user: updated.user,
    };
  }

  async getEventAttendance(eventId: string, creatorId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { creatorId: true },
    });

    if (!event) throw new NotFoundException('Event not found');
    if (event.creatorId !== creatorId)
      throw new ForbiddenException('Only event creator can view attendance');

    return this.prisma.attendance.findMany({
      where: {
        eventId,
        userId: { not: event.creatorId },
        status: { not: AttendanceStatus.LEFT },
      },
      include: {
        user: {
          select: { id: true, username: true, avatar: true, rating: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async rateOrganizer(eventId: string, raterId: string, score: number) {
    if (score < 1 || score > 5 || !Number.isInteger(score))
      throw new BadRequestException('Score must be an integer between 1 and 5');

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { creatorId: true, status: true },
    });

    if (!event) throw new NotFoundException('Event not found');
    if (
      event.status !== EventStatus.FINALIZED &&
      event.status !== EventStatus.COMPLETED
    )
      throw new BadRequestException('Event must be completed before rating');
    if (event.creatorId === raterId)
      throw new BadRequestException('Cannot rate yourself');

    const attendance = await this.prisma.attendance.findUnique({
      where: { eventId_userId: { eventId, userId: raterId } },
    });

    const existing = await this.prisma.organizerRating.findUnique({
      where: { eventId_raterId: { eventId, raterId } },
    });
    if (existing)
      throw new ConflictException(
        'Already rated this organizer for this event',
      );

    const { canRateOrganizer } = organizerRatingViewerState({
      viewerId: raterId,
      organizerId: event.creatorId,
      eventStatus: event.status,
      attendanceStatus: attendance?.status,
      hasExistingRating: false,
    });
    if (!canRateOrganizer)
      throw new ForbiddenException(
        'You cannot rate the organizer for this event',
      );

    await this.prisma.organizerRating.create({
      data: { eventId, raterId, targetId: event.creatorId, score },
    });

    const agg = await this.prisma.organizerRating.aggregate({
      where: { targetId: event.creatorId },
      _avg: { score: true },
      _count: { score: true },
    });

    await this.prisma.user.update({
      where: { id: event.creatorId },
      data: {
        organizerRating: agg._avg.score ?? 0,
        organizerRatingCount: agg._count.score,
      },
    });

    this.notificationsGateway.sendToUser(event.creatorId, 'notification', {
      type: 'ORGANIZER_RATED',
      eventId,
      score,
      newRating: agg._avg.score ?? 0,
      totalRatings: agg._count.score,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      organizerRating: agg._avg.score ?? 0,
      totalRatings: agg._count.score,
    };
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number | null,
    lon2: number | null,
  ): number {
    if (lat2 == null || lon2 == null) return Infinity;

    const R = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRadians(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private sendProfileEventsUpdated(userId: string) {
    const notificationId = uuidv7();
    const payload = {
      type: PushType.PROFILE_EVENTS_UPDATED,
      notificationId,
      timestamp: new Date().toISOString(),
    };
    void this.notificationDispatcher
      .notifyUser(userId, payload, payload, {
        ...PUSH_POLICY[PushType.PROFILE_EVENTS_UPDATED],
        dedupeKey: `profile_events:${userId}`,
      })
      .catch((error: Error) => {
        this.logger.error(
          `PROFILE_EVENTS_UPDATED push failed user=${userId}: ${error.message}`,
        );
      });
  }
}
