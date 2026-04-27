/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PushType } from '../notifications/push.types';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('EventsService', () => {
  let service: EventsService;
  let prisma: any;
  let dispatcher: { notifyUser: jest.Mock; notifyUsers: jest.Mock };
  let notificationsGateway: {
    sendToUser: jest.Mock;
    broadcastNotification: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      event: { create: jest.fn() },
      eventParticipant: { create: jest.fn() },
      attendance: { create: jest.fn() },
      friendship: { findMany: jest.fn() },
    };
    dispatcher = {
      notifyUser: jest.fn().mockResolvedValue(undefined),
      notifyUsers: jest.fn().mockResolvedValue(undefined),
    };
    notificationsGateway = {
      sendToUser: jest.fn(),
      broadcastNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ChatService,
          useValue: {
            createChatForEvent: jest
              .fn()
              .mockResolvedValue({ id: 'chat-test-id' }),
          },
        },
        {
          provide: ChatGateway,
          useValue: { broadcastSystemMessage: jest.fn() },
        },
        { provide: NotificationDispatcherService, useValue: dispatcher },
        { provide: NotificationsGateway, useValue: notificationsGateway },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  it('sends FRIEND_EVENT_CREATED to creator friends', async () => {
    prisma.event.create.mockResolvedValue({ id: 'event-1' });
    prisma.eventParticipant.create.mockResolvedValue({});
    prisma.friendship.findMany.mockResolvedValue([{ friendId: 'f1' }]);
    jest
      .spyOn(service, 'getEventById')
      .mockResolvedValue({ id: 'event-1' } as any);

    await service.create(
      {
        eventName: 'Party',
        description: 'desc',
        category: 'party' as any,
        date: new Date().toISOString(),
        isAllDay: true,
        visibility: 'PUBLIC' as any,
        locationName: 'place',
        locationAddress: 'addr',
        locationLatitude: 1,
        locationLongitude: 1,
        maxParticipants: 5,
      } as any,
      'creator',
    );

    expect(dispatcher.notifyUsers).toHaveBeenCalled();
    const [, payload] = dispatcher.notifyUsers.mock.calls[0];
    expect(payload.type).toBe(PushType.FRIEND_EVENT_CREATED);
    expect(notificationsGateway.broadcastNotification).toHaveBeenCalledWith(
      'notification',
      expect.objectContaining({
        type: 'EVENTS_MAP_STALE',
        eventId: 'event-1',
      }),
    );
  });

  it('does not broadcast EVENTS_MAP_STALE for PRIVATE events', async () => {
    prisma.event.create.mockResolvedValue({ id: 'event-private' });
    prisma.eventParticipant.create.mockResolvedValue({});
    prisma.friendship.findMany.mockResolvedValue([]);
    jest
      .spyOn(service, 'getEventById')
      .mockResolvedValue({ id: 'event-private' } as any);

    await service.create(
      {
        eventName: 'Secret',
        description: 'desc',
        category: 'party' as any,
        date: new Date().toISOString(),
        isAllDay: true,
        visibility: 'PRIVATE' as any,
        locationName: 'place',
        locationAddress: 'addr',
        locationLatitude: 1,
        locationLongitude: 1,
        maxParticipants: 5,
      } as any,
      'creator',
    );

    expect(notificationsGateway.broadcastNotification).not.toHaveBeenCalled();
  });

  it('create rejects timed event when end is not after start', async () => {
    await expect(
      service.create(
        {
          eventName: 'E',
          description: 'd',
          category: 'party' as any,
          date: '2026-01-01T00:00:00.000Z',
          isAllDay: false,
          visibility: 'PUBLIC' as any,
          locationName: 'x',
          locationAddress: 'y',
          locationLatitude: 0,
          locationLongitude: 0,
          maxParticipants: 5,
          startTime: '2026-01-01T18:00:00.000Z',
          endTime: '2026-01-01T10:00:00.000Z',
        } as any,
        'u1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.event.create).not.toHaveBeenCalled();
  });

  it('getEventAttendance excludes creator from query', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const fullPrisma = {
      event: {
        findUnique: jest.fn().mockResolvedValue({ creatorId: 'c1' }),
      },
      attendance: { findMany: findMany },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: fullPrisma },
        { provide: ChatService, useValue: {} },
        { provide: ChatGateway, useValue: {} },
        { provide: NotificationDispatcherService, useValue: {} },
        { provide: NotificationsGateway, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    const svc = module.get<EventsService>(EventsService);

    await svc.getEventAttendance('e1', 'c1');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: { not: 'c1' },
        }),
      }),
    );
    await module.close();
  });

  it('toggleCheckIn rejects organizer as target', async () => {
    const start = new Date(Date.now() - 60 * 60 * 1000);
    const end = new Date(Date.now() + 60 * 60 * 1000);
    const fullPrisma = {
      event: {
        findUnique: jest.fn().mockResolvedValue({
          creatorId: 'c1',
          status: 'ACTIVE',
          endTime: end,
          date: start,
          startTime: start,
          eventName: 'E',
          chat: null,
        }),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: fullPrisma },
        { provide: ChatService, useValue: {} },
        { provide: ChatGateway, useValue: {} },
        { provide: NotificationDispatcherService, useValue: {} },
        { provide: NotificationsGateway, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    const svc = module.get<EventsService>(EventsService);

    await expect(svc.toggleCheckIn('e1', 'c1', 'c1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await module.close();
  });

  describe('rateOrganizer', () => {
    let rateService: EventsService;
    let ratePrisma: {
      event: { findUnique: jest.Mock };
      attendance: { findUnique: jest.Mock };
      organizerRating: {
        findUnique: jest.Mock;
        create: jest.Mock;
        aggregate: jest.Mock;
      };
      user: { update: jest.Mock };
    };
    let rateNotifs: { sendToUser: jest.Mock; broadcastNotification: jest.Mock };

    beforeEach(async () => {
      rateNotifs = { sendToUser: jest.fn(), broadcastNotification: jest.fn() };
      ratePrisma = {
        event: { findUnique: jest.fn() },
        attendance: { findUnique: jest.fn() },
        organizerRating: {
          findUnique: jest.fn(),
          create: jest.fn(),
          aggregate: jest.fn(),
        },
        user: { update: jest.fn() },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EventsService,
          { provide: PrismaService, useValue: ratePrisma },
          { provide: ChatService, useValue: {} },
          { provide: ChatGateway, useValue: {} },
          { provide: NotificationDispatcherService, useValue: {} },
          { provide: NotificationsGateway, useValue: rateNotifs },
          { provide: ConfigService, useValue: { get: jest.fn() } },
        ],
      }).compile();

      rateService = module.get<EventsService>(EventsService);
    });

    it('allows JOINED attendee when event is FINALIZED', async () => {
      ratePrisma.event.findUnique.mockResolvedValue({
        creatorId: 'org',
        status: 'FINALIZED',
      });
      ratePrisma.attendance.findUnique.mockResolvedValue({ status: 'JOINED' });
      ratePrisma.organizerRating.findUnique.mockResolvedValue(null);
      ratePrisma.organizerRating.create.mockResolvedValue({});
      ratePrisma.organizerRating.aggregate.mockResolvedValue({
        _avg: { score: 4 },
        _count: { score: 2 },
      });
      ratePrisma.user.update.mockResolvedValue({});

      const result = await rateService.rateOrganizer('e1', 'u1', 5);

      expect(result.success).toBe(true);
      expect(ratePrisma.organizerRating.create).toHaveBeenCalled();
      expect(rateNotifs.sendToUser).toHaveBeenCalledWith(
        'org',
        'notification',
        expect.objectContaining({ type: 'ORGANIZER_RATED' }),
      );
    });

    it('rejects JOINED attendee when event is only COMPLETED', async () => {
      ratePrisma.event.findUnique.mockResolvedValue({
        creatorId: 'org',
        status: 'COMPLETED',
      });
      ratePrisma.attendance.findUnique.mockResolvedValue({ status: 'JOINED' });
      ratePrisma.organizerRating.findUnique.mockResolvedValue(null);

      await expect(rateService.rateOrganizer('e1', 'u1', 5)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(ratePrisma.organizerRating.create).not.toHaveBeenCalled();
    });

    it('rejects organizer self-rating', async () => {
      ratePrisma.event.findUnique.mockResolvedValue({
        creatorId: 'org',
        status: 'FINALIZED',
      });

      await expect(rateService.rateOrganizer('e1', 'org', 5)).rejects.toThrow();
      expect(ratePrisma.organizerRating.findUnique).not.toHaveBeenCalled();
    });
  });
});
