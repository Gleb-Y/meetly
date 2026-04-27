/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { EventSchedulerService } from './event-scheduler.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
import { AttendanceStatus } from '@prisma/client';
import { PushType } from '../notifications/push.types';

describe('EventSchedulerService', () => {
  it('finalizeEvent: organizer marked nobody — guests get ATTENDANCE_REWARD, organizer reminder + host karma', async () => {
    const userUpdate = jest.fn().mockResolvedValue({});
    const findMany = jest.fn().mockResolvedValue([
      { id: 'guest1', rating: 5, totalAttended: 0 },
    ]);
    const prisma = {
      user: {
        findMany,
        findUnique: jest.fn().mockResolvedValue({ rating: 5 }),
        update: userUpdate,
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      event: { update: jest.fn() },
      organizerRating: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const chatGateway = {
      broadcastSystemMessage: jest.fn(),
      server: { to: jest.fn().mockReturnValue({ emit: jest.fn() }) },
    };
    const notificationDispatcher = {
      notifyUsers: jest.fn(),
      notifyUser: jest.fn().mockResolvedValue(undefined),
      notifyProfileKarmaRefetch: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventSchedulerService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChatGateway, useValue: chatGateway },
        {
          provide: NotificationDispatcherService,
          useValue: notificationDispatcher,
        },
      ],
    }).compile();

    const service = module.get(EventSchedulerService);
    const now = new Date();

    await (service as any).finalizeEvent(
      {
        id: 'e1',
        eventName: 'Test',
        creatorId: 'creator1',
        chat: null,
        attendances: [
          {
            id: 'a1',
            userId: 'creator1',
            status: AttendanceStatus.JOINED,
          },
          {
            id: 'a2',
            userId: 'guest1',
            status: AttendanceStatus.JOINED,
          },
        ],
      },
      now,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['guest1'] } },
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(userUpdate).toHaveBeenCalledTimes(2);
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'guest1' },
        data: expect.objectContaining({
          rating: 5,
          totalAttended: 1,
        }),
      }),
    );
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'creator1' } }),
    );

    const notifyCalls = notificationDispatcher.notifyUser.mock.calls;
    const types = notifyCalls.map((c) => (c[1] as { type: string }).type);
    expect(types).toContain(PushType.ATTENDANCE_REWARD);
    expect(types).toContain(PushType.ORGANIZER_ATTENDANCE_REMINDER);
    expect(types).toContain(PushType.ORGANIZER_HOST_KARMA);

    const guestReward = notifyCalls.find(
      (c) => (c[1] as { type: string }).type === PushType.ATTENDANCE_REWARD,
    );
    expect(guestReward?.[0]).toBe('guest1');

    await module.close();
  });

  it('finalizeEvent: partial marking — JOINED guest gets NO_SHOW only, no reminder', async () => {
    const userUpdate = jest.fn().mockResolvedValue({});
    const findMany = jest.fn().mockResolvedValue([
      { id: 'guest2', rating: 5, totalAttended: 0 },
    ]);
    const prisma = {
      user: {
        findMany,
        findUnique: jest.fn().mockResolvedValue({ rating: 5 }),
        update: userUpdate,
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      event: { update: jest.fn() },
      organizerRating: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const chatGateway = {
      broadcastSystemMessage: jest.fn(),
      server: { to: jest.fn().mockReturnValue({ emit: jest.fn() }) },
    };
    const notificationDispatcher = {
      notifyUsers: jest.fn(),
      notifyUser: jest.fn().mockResolvedValue(undefined),
      notifyProfileKarmaRefetch: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventSchedulerService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChatGateway, useValue: chatGateway },
        {
          provide: NotificationDispatcherService,
          useValue: notificationDispatcher,
        },
      ],
    }).compile();

    const service = module.get(EventSchedulerService);
    const now = new Date();

    await (service as any).finalizeEvent(
      {
        id: 'e2',
        eventName: 'Partial',
        creatorId: 'creator1',
        chat: null,
        attendances: [
          {
            id: 'a1',
            userId: 'creator1',
            status: AttendanceStatus.JOINED,
          },
          {
            id: 'a2',
            userId: 'guest1',
            status: AttendanceStatus.CONFIRMED,
          },
          {
            id: 'a3',
            userId: 'guest2',
            status: AttendanceStatus.JOINED,
          },
        ],
      },
      now,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['guest2'] } },
      }),
    );
    const notifyCalls = notificationDispatcher.notifyUser.mock.calls;
    const types = notifyCalls.map((c) => (c[1] as { type: string }).type);
    expect(types).toContain(PushType.NO_SHOW_PENALTY);
    expect(types).not.toContain(PushType.ORGANIZER_ATTENDANCE_REMINDER);
    expect(types).toContain(PushType.ORGANIZER_HOST_KARMA);

    const penalty = notifyCalls.find(
      (c) => (c[1] as { type: string }).type === PushType.NO_SHOW_PENALTY,
    );
    expect(penalty?.[0]).toBe('guest2');

    await module.close();
  });

  it('expired-events query uses UTC start-of-day for all-day branch', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { event: { findMany, updateMany: jest.fn() } };
    const notificationDispatcher = { notifyUsers: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventSchedulerService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChatGateway, useValue: { server: { to: jest.fn() } } },
        {
          provide: NotificationDispatcherService,
          useValue: notificationDispatcher,
        },
      ],
    }).compile();

    const service = module.get(EventSchedulerService);
    await service.handleExpiredEvents();

    expect(findMany).toHaveBeenCalled();
    const arg = findMany.mock.calls[0][0];
    const allDayOr = arg.where.OR.find(
      (o: { isAllDay?: boolean }) => o.isAllDay === true,
    );
    expect(allDayOr.date.lt.toISOString()).toMatch(/T00:00:00\.000Z$/);

    await module.close();
  });
});
