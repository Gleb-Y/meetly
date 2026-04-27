/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FriendsService } from './friends.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PushType } from '../notifications/push.types';

describe('FriendsService', () => {
  let service: FriendsService;
  let prisma: any;
  let dispatcher: { notifyUser: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), findMany: jest.fn() },
      friendship: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      friendRequest: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    dispatcher = { notifyUser: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FriendsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationDispatcherService, useValue: dispatcher },
        { provide: NotificationsGateway, useValue: { sendToUser: jest.fn() } },
      ],
    }).compile();

    service = module.get<FriendsService>(FriendsService);
  });

  it('cancelFriendRequest notifies receiver with FRIEND_REQUEST_CANCELLED', async () => {
    prisma.friendRequest.findUnique.mockResolvedValue({
      id: 'req-cancel-1',
      senderId: 'sender',
      receiverId: 'receiver',
      status: 'PENDING',
    });
    prisma.friendRequest.delete.mockResolvedValue({});

    await service.cancelFriendRequest('req-cancel-1', 'sender');

    expect(prisma.friendRequest.delete).toHaveBeenCalledWith({
      where: { id: 'req-cancel-1' },
    });
    const gateway = (service as any).notificationsGateway as {
      sendToUser: jest.Mock;
    };
    expect(gateway.sendToUser).toHaveBeenCalledTimes(1);
    const [targetUserId, eventName, payload] = gateway.sendToUser.mock.calls[0];
    expect(targetUserId).toBe('receiver');
    expect(eventName).toBe('notification');
    expect(payload).toMatchObject({
      type: 'FRIEND_REQUEST_CANCELLED',
      requestId: 'req-cancel-1',
      senderId: 'sender',
    });
    expect(typeof payload.timestamp).toBe('string');
  });

  it('removeFriend deletes all friend_requests between the pair', async () => {
    prisma.friendship.findUnique.mockResolvedValue({ id: 'fs-1' });
    prisma.$transaction.mockImplementation(async (operations: unknown[]) =>
      Promise.all(operations as Promise<unknown>[]),
    );
    prisma.friendship.deleteMany.mockResolvedValue({ count: 2 });
    prisma.friendRequest.deleteMany.mockResolvedValue({ count: 1 });

    await service.removeFriend('u1', 'u2');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.friendship.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { userId: 'u1', friendId: 'u2' },
          { userId: 'u2', friendId: 'u1' },
        ],
      },
    });
    expect(prisma.friendRequest.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { senderId: 'u1', receiverId: 'u2' },
          { senderId: 'u2', receiverId: 'u1' },
        ],
      },
    });
  });

  it('sends FRIEND_REQUEST notification to receiver', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'receiver',
      isActive: true,
    });
    prisma.friendship.findUnique.mockResolvedValue(null);
    prisma.friendRequest.findFirst.mockResolvedValue(null);
    prisma.friendRequest.findUnique.mockResolvedValue(null);
    prisma.friendRequest.create.mockResolvedValue({
      id: 'req-1',
      createdAt: new Date(),
      sender: { id: 'sender', username: 'sam', avatar: null },
      receiver: { id: 'receiver' },
    });

    await service.sendFriendRequest('sender', 'receiver');

    expect(dispatcher.notifyUser).toHaveBeenCalled();
    const [userId, payload] = dispatcher.notifyUser.mock.calls[0];
    expect(userId).toBe('receiver');
    expect(payload.type).toBe(PushType.FRIEND_REQUEST);
  });

  it('sends FRIEND_REQUEST_ACCEPTED notification with consistent payload', async () => {
    prisma.friendRequest.findUnique.mockResolvedValue({
      id: 'req-accept-1',
      senderId: 'sender',
      receiverId: 'receiver',
      status: 'PENDING',
      sender: { id: 'sender', username: 'sam', avatar: null },
      receiver: { id: 'receiver', username: 'alex', avatar: 'a.png' },
    });
    prisma.friendRequest.update.mockResolvedValue({
      id: 'req-accept-1',
      senderId: 'sender',
      receiverId: 'receiver',
      sender: { id: 'sender', username: 'sam', avatar: null },
      receiver: { id: 'receiver', username: 'alex', avatar: 'a.png' },
    });
    prisma.friendship.create.mockResolvedValue({});
    prisma.$transaction.mockImplementation(async (operations: unknown[]) =>
      Promise.all(operations as Promise<unknown>[]),
    );

    await service.acceptFriendRequest('req-accept-1', 'receiver');

    const gateway = (service as any).notificationsGateway as {
      sendToUser: jest.Mock;
    };
    expect(gateway.sendToUser).toHaveBeenCalledTimes(1);
    const [targetUserId, eventName, payload] = gateway.sendToUser.mock.calls[0];
    expect(targetUserId).toBe('sender');
    expect(eventName).toBe('notification');
    expect(payload).toMatchObject({
      type: 'FRIEND_REQUEST_ACCEPTED',
      requestId: 'req-accept-1',
      userId: 'receiver',
      friendId: 'receiver',
      acceptedByUserId: 'receiver',
      userName: 'alex',
      avatar: 'a.png',
    });
    expect(typeof payload.timestamp).toBe('string');
  });

  it('getMutualFriends returns empty when target hid friends on profile', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'target',
      isActive: true,
      showFriendsInProfile: false,
      isProfileClosed: false,
    });
    prisma.friendship.findUnique.mockResolvedValue(null);

    const result = await service.getMutualFriends('viewer', 'target');

    expect(result).toEqual([]);
    expect(prisma.friendship.findMany).not.toHaveBeenCalled();
  });

  it('getMutualFriends returns empty when target has closed profile and viewer is not a friend', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'target',
      isActive: true,
      showFriendsInProfile: true,
      isProfileClosed: true,
    });
    prisma.friendship.findUnique.mockResolvedValue(null);

    const result = await service.getMutualFriends('viewer', 'target');

    expect(result).toEqual([]);
    expect(prisma.friendship.findMany).not.toHaveBeenCalled();
  });

  it('getMutualFriends loads mutuals when viewer is friend and profile is closed but showFriends is on', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'target',
      isActive: true,
      showFriendsInProfile: true,
      isProfileClosed: true,
    });
    prisma.friendship.findUnique.mockResolvedValue({ id: 'f1' });
    prisma.friendship.findMany
      .mockResolvedValueOnce([{ friendId: 'm1' }])
      .mockResolvedValueOnce([{ friendId: 'm1' }]);
    prisma.user.findMany.mockResolvedValue([
      { id: 'm1', username: 'mutual', avatar: null },
    ]);

    const result = await service.getMutualFriends('viewer', 'target');

    expect(result).toEqual([{ id: 'm1', username: 'mutual', avatar: null }]);
    expect(prisma.friendship.findMany).toHaveBeenCalled();
  });

  describe('getFriendsOfUser', () => {
    it('matches getFriends for own userId without loading target profile', async () => {
      prisma.friendship.findMany.mockResolvedValue([
        {
          id: 'fs-1',
          createdAt: new Date('2024-06-01'),
          friend: {
            id: 'f1',
            username: 'pal',
            avatar: null,
            bio: null,
            isActive: true,
          },
        },
      ]);

      const result = await service.getFriendsOfUser('me', 'me');

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual([
        {
          friendshipId: 'fs-1',
          friendsSince: new Date('2024-06-01'),
          id: 'f1',
          username: 'pal',
          avatar: null,
          bio: null,
          isActive: true,
        },
      ]);
    });

    it('returns [] when target hid friends list', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'target',
        isActive: true,
        showFriendsInProfile: false,
        isProfileClosed: false,
      });
      prisma.friendship.findUnique.mockResolvedValue(null);

      const result = await service.getFriendsOfUser('viewer', 'target');

      expect(result).toEqual([]);
      expect(prisma.friendship.findMany).not.toHaveBeenCalled();
    });

    it('returns [] when profile is closed and viewer is not a friend', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'target',
        isActive: true,
        showFriendsInProfile: true,
        isProfileClosed: true,
      });
      prisma.friendship.findUnique.mockResolvedValue(null);

      const result = await service.getFriendsOfUser('viewer', 'target');

      expect(result).toEqual([]);
      expect(prisma.friendship.findMany).not.toHaveBeenCalled();
    });

    it('returns friend list when open profile and friends are visible', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'target',
        isActive: true,
        showFriendsInProfile: true,
        isProfileClosed: false,
      });
      prisma.friendship.findUnique.mockResolvedValue(null);
      prisma.friendship.findMany.mockResolvedValue([
        {
          id: 'fs-2',
          createdAt: new Date('2024-07-01'),
          friend: {
            id: 'f2',
            username: 'buddy',
            avatar: 'a.png',
            bio: null,
            isActive: true,
          },
        },
      ]);

      const result = await service.getFriendsOfUser('viewer', 'target');

      expect(result[0].username).toBe('buddy');
      expect(result[0].friendshipId).toBe('fs-2');
    });

    it('throws when target user is missing or inactive', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.getFriendsOfUser('viewer', 'gone'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
