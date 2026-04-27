/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
import { PushType } from '../notifications/push.types';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: any;
  let dispatcher: { notifyUsers: jest.Mock };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      user: {
        findUnique: jest.fn(),
      },
      chat: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      chatUserSettings: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      message: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      messageRead: {
        findMany: jest.fn(),
        createMany: jest.fn(),
      },
      reaction: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
    };
    dispatcher = { notifyUsers: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationDispatcherService, useValue: dispatcher },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('sends CHAT_MESSAGE push to participants except sender', async () => {
    jest.spyOn(service as any, 'checkAccess').mockResolvedValue('event-1');
    prisma.$transaction.mockResolvedValue({
      id: 'message-1',
      content: 'hello',
      sender: { username: 'alex' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.chat.findUnique.mockResolvedValue({
      event: {
        eventName: 'My Event',
        photoUrl: 'https://cdn.example.com/event.jpg',
        participants: [{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }],
      },
    });

    await service.sendMessage('chat-1', 'u1', 'hello');

    expect(dispatcher.notifyUsers).toHaveBeenCalled();
    const [recipients, socketPayload] = dispatcher.notifyUsers.mock.calls[0];
    expect(recipients).toEqual(['u2', 'u3']);
    expect(socketPayload.type).toBe(PushType.CHAT_MESSAGE);
    expect(socketPayload.chatId).toBe('chat-1');
    expect(socketPayload.eventTitle).toBe('My Event');
    expect(socketPayload.eventPhotoUrl).toBe('https://cdn.example.com/event.jpg');
    expect(socketPayload.senderName).toBe('alex');
    expect(socketPayload.messageText).toBe('hello');
  });

  it('does not notify recipients muted for this chat', async () => {
    jest.spyOn(service as any, 'checkAccess').mockResolvedValue('event-1');
    prisma.$transaction.mockResolvedValue({
      id: 'message-2',
      content: 'hello muted',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.chat.findUnique.mockResolvedValue({
      event: {
        eventName: 'My Event',
        photoUrl: 'https://cdn.example.com/event.jpg',
        participants: [{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }],
      },
    });
    prisma.chatUserSettings.findMany.mockResolvedValue([{ userId: 'u2' }]);

    await service.sendMessage('chat-1', 'u1', 'hello muted');

    expect(dispatcher.notifyUsers).toHaveBeenCalledWith(
      ['u3'],
      expect.objectContaining({ type: PushType.CHAT_MESSAGE, chatId: 'chat-1' }),
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('returns mute status false when no settings row exists', async () => {
    jest.spyOn(service as any, 'checkAccess').mockResolvedValue('event-1');
    prisma.chatUserSettings.findUnique.mockResolvedValue(null);

    const result = await service.getChatMuteStatus('chat-1', 'u1');

    expect(result).toEqual({ chatId: 'chat-1', isMuted: false });
  });

  it('upserts mute status for user and chat', async () => {
    jest.spyOn(service as any, 'checkAccess').mockResolvedValue('event-1');
    prisma.chatUserSettings.upsert.mockResolvedValue({ isMuted: true });

    const result = await service.setChatMuteStatus('chat-1', 'u1', true);

    expect(prisma.chatUserSettings.upsert).toHaveBeenCalledWith({
      where: { userId_chatId: { userId: 'u1', chatId: 'chat-1' } },
      create: { userId: 'u1', chatId: 'chat-1', isMuted: true },
      update: { isMuted: true },
      select: { isMuted: true },
    });
    expect(result).toEqual({ chatId: 'chat-1', isMuted: true });
  });

  it('edits own message', async () => {
    const now = new Date();
    prisma.message.findUnique.mockResolvedValue({
      id: 'm-1',
      chatId: 'chat-1',
      senderId: 'u1',
      isSystem: false,
      createdAt: now,
    });
    prisma.message.update.mockResolvedValue({
      id: 'm-1',
      chatId: 'chat-1',
      senderId: 'u1',
      content: 'updated message',
      imageUrl: null,
      isSystem: false,
      createdAt: now,
      updatedAt: new Date(now.getTime() + 1000),
      replyToId: null,
      sender: { id: 'u1', username: 'alex', avatar: null },
      replyTo: null,
      reactions: [],
      readBy: [{ userId: 'u1' }, { userId: 'u2' }],
      _count: { readBy: 2 },
    });
    jest.spyOn(service as any, 'checkAccess').mockResolvedValue('event-1');

    const result = await service.editMessage('m-1', 'u1', ' updated message ');

    expect(prisma.message.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm-1' },
        data: { content: 'updated message' },
      }),
    );
    expect(result.isEdited).toBe(true);
    expect(result.isRead).toBe(true);
    expect(result.readByCount).toBe(1);
  });

  it('does not allow editing someone else message', async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 'm-1',
      chatId: 'chat-1',
      senderId: 'u2',
      isSystem: false,
      createdAt: new Date(),
    });

    await expect(
      service.editMessage('m-1', 'u1', 'new'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deletes last message and updates chat lastMessage fields', async () => {
    const now = new Date();
    const older = new Date(now.getTime() - 1000);
    prisma.message.findUnique.mockResolvedValue({
      id: 'm-last',
      chatId: 'chat-1',
      senderId: 'u1',
      isSystem: false,
      createdAt: now,
    });
    jest.spyOn(service as any, 'checkAccess').mockResolvedValue('event-1');

    const tx = {
      message: {
        delete: jest.fn().mockResolvedValue(undefined),
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'm-prev', createdAt: older }),
      },
      chat: {
        findUnique: jest.fn().mockResolvedValue({ lastMessageId: 'm-last' }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    prisma.$transaction.mockImplementation((cb: any) => cb(tx));

    const result = await service.deleteMessage('m-last', 'u1');

    expect(tx.message.delete).toHaveBeenCalledWith({ where: { id: 'm-last' } });
    expect(tx.chat.update).toHaveBeenCalledWith({
      where: { id: 'chat-1' },
      data: { lastMessageId: 'm-prev', lastMessageAt: older },
    });
    expect(result).toEqual({
      success: true,
      messageId: 'm-last',
      chatId: 'chat-1',
    });
  });

  it('rejects empty content on edit', async () => {
    await expect(
      service.editMessage('m-1', 'u1', '   '),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('getMessages groups reactions with reactors sorted by userId', async () => {
    const created = new Date('2025-01-01T00:00:00.000Z');
    const base = {
      chatId: 'chat-1',
      senderId: 'u1',
      content: 'hi',
      imageUrl: null,
      isSystem: false,
      replyToId: null,
      sender: { id: 'u1', username: 'alex', avatar: null },
      replyTo: null,
      readBy: [],
      _count: { readBy: 0 },
    };
    prisma.message.findMany.mockResolvedValue([
      {
        id: 'm1',
        ...base,
        reactions: [
          {
            emoji: '👍',
            userId: 'u3',
            user: { id: 'u3', username: 'c', avatar: 'a3' },
          },
          {
            emoji: '👍',
            userId: 'u2',
            user: { id: 'u2', username: 'b', avatar: 'a2' },
          },
          {
            emoji: '👍',
            userId: 'u1',
            user: { id: 'u1', username: 'alex', avatar: null },
          },
        ],
        createdAt: created,
        updatedAt: created,
      },
    ]);
    jest.spyOn(service as any, 'checkAccess').mockResolvedValue(undefined);

    const { messages } = await service.getMessages('chat-1', 'u1', 50);

    const grouped = messages[0].reactions[0];
    expect(grouped.emoji).toBe('👍');
    expect(grouped.count).toBe(3);
    expect(grouped.userIds).toEqual(['u1', 'u2', 'u3']);
    expect(grouped.reactors).toEqual([
      { id: 'u1', username: 'alex', avatar: null },
      { id: 'u2', username: 'b', avatar: 'a2' },
      { id: 'u3', username: 'c', avatar: 'a3' },
    ]);
    expect(grouped.hasReacted).toBe(true);
  });

  it('getMessageReactions checks chat access then returns reactions with user', async () => {
    prisma.message.findUnique.mockResolvedValue({ chatId: 'chat-1' });
    const checkAccessSpy = jest
      .spyOn(service as any, 'checkAccess')
      .mockResolvedValue(undefined);
    prisma.reaction.findMany.mockResolvedValue([
      {
        id: 'r1',
        messageId: 'm1',
        userId: 'u2',
        emoji: '👍',
        createdAt: new Date(),
        user: { id: 'u2', username: 'bob', avatar: 'http://x' },
      },
    ]);

    const rows = await service.getMessageReactions('m1', 'u1');

    expect(checkAccessSpy).toHaveBeenCalledWith('chat-1', 'u1');
    expect(prisma.reaction.findMany).toHaveBeenCalledWith({
      where: { messageId: 'm1' },
      include: { user: { select: { id: true, username: true, avatar: true } } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].user).toEqual({
      id: 'u2',
      username: 'bob',
      avatar: 'http://x',
    });
  });

  it('toggleReaction returns user preview on add', async () => {
    prisma.message.findUnique.mockResolvedValue({ chatId: 'chat-1' });
    jest.spyOn(service as any, 'checkAccess').mockResolvedValue(undefined);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      username: 'me',
      avatar: 'http://av',
    });
    prisma.reaction.findFirst.mockResolvedValue(null);
    prisma.reaction.create.mockResolvedValue({});

    const result = await service.toggleReaction('m1', 'u1', '👍');

    expect(result).toEqual({
      action: 'added',
      reaction: {
        emoji: '👍',
        userId: 'u1',
        user: { id: 'u1', username: 'me', avatar: 'http://av' },
      },
      chatId: 'chat-1',
    });
  });

  it('getMessages sets isEdited when updatedAt is after createdAt', async () => {
    const created = new Date('2025-01-01T00:00:00.000Z');
    const updatedLater = new Date('2025-01-02T00:00:00.000Z');
    const base = {
      chatId: 'chat-1',
      senderId: 'u1',
      content: 'hi',
      imageUrl: null,
      isSystem: false,
      replyToId: null,
      sender: { id: 'u1', username: 'alex', avatar: null },
      replyTo: null,
      reactions: [],
      readBy: [{ userId: 'u2' }],
      _count: { readBy: 1 },
    };
    prisma.message.findMany.mockResolvedValue([
      { id: 'm-new', ...base, createdAt: created, updatedAt: created },
      { id: 'm-edited', ...base, createdAt: created, updatedAt: updatedLater },
    ]);
    jest.spyOn(service as any, 'checkAccess').mockResolvedValue(undefined);

    const { messages } = await service.getMessages('chat-1', 'u1', 50);

    expect(messages.find((m) => m.id === 'm-new')?.isEdited).toBe(false);
    expect(messages.find((m) => m.id === 'm-edited')?.isEdited).toBe(true);
  });

  it('sendSystemMessage creates MessageRead for sender and returns isRead true for actor', async () => {
    const createdAt = new Date();
    const messageRow = {
      id: 'sys-msg-1',
      chatId: 'chat-1',
      senderId: 'actor',
      content: 'joined',
      isSystem: true,
      createdAt,
      updatedAt: createdAt,
      sender: { id: 'actor', username: 'alex', avatar: null },
    };
    const tx = {
      message: {
        create: jest.fn().mockResolvedValue(messageRow),
      },
      messageRead: {
        create: jest.fn().mockResolvedValue({}),
      },
      chat: {
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    prisma.$transaction.mockImplementation((cb: any) => cb(tx));

    const result = await service.sendSystemMessage(
      'chat-1',
      'actor',
      'joined',
    );

    expect(tx.messageRead.create).toHaveBeenCalledWith({
      data: { messageId: 'sys-msg-1', userId: 'actor' },
    });
    expect(result.isRead).toBe(true);
    expect(result.readByCount).toBe(0);
  });

  it('getChat includes unreadCount from shared unread predicate path', async () => {
    jest.spyOn(service as any, 'checkAccess').mockResolvedValue('event-1');
    prisma.chat.findUnique.mockResolvedValue({
      id: 'chat-1',
      event: { id: 'event-1', eventName: 'Event', status: 'ACTIVE', participants: [] },
    });
    jest.spyOn(service, 'getMessages').mockResolvedValue({
      messages: [],
      nextCursor: null,
      hasMore: false,
    });
    jest.spyOn(service, 'getUnreadCount').mockResolvedValue(3);

    const result = await service.getChat('chat-1', 'u1', 50);

    expect(result.unreadCount).toBe(3);
    expect(service.getUnreadCount).toHaveBeenCalledWith('chat-1', 'u1');
  });

  it('markChatAsRead creates rows only for unread messages by same predicate', async () => {
    prisma.message.findMany.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);
    prisma.messageRead.createMany.mockResolvedValue({ count: 2 });

    const result = await service.markChatAsRead('chat-1', 'u1');

    expect(prisma.message.findMany).toHaveBeenCalledWith({
      where: {
        chatId: 'chat-1',
        senderId: { not: 'u1' },
        readBy: { none: { userId: 'u1' } },
      },
      select: { id: true },
    });
    expect(prisma.messageRead.createMany).toHaveBeenCalledWith({
      data: [
        { messageId: 'm1', userId: 'u1', readAt: expect.any(Date) },
        { messageId: 'm2', userId: 'u1', readAt: expect.any(Date) },
      ],
      skipDuplicates: true,
    });
    expect(result).toEqual({ success: true, count: 2 });
  });

  it('getUnreadCount and getTotalUnreadCount use the same unread predicate core', async () => {
    prisma.message.count.mockResolvedValueOnce(4).mockResolvedValueOnce(10);

    await service.getUnreadCount('chat-1', 'u1');
    await service.getTotalUnreadCount('u1');

    expect(prisma.message.count).toHaveBeenNthCalledWith(1, {
      where: {
        chatId: 'chat-1',
        senderId: { not: 'u1' },
        readBy: { none: { userId: 'u1' } },
      },
    });
    expect(prisma.message.count).toHaveBeenNthCalledWith(2, {
      where: {
        chat: { event: { participants: { some: { userId: 'u1' } } } },
        senderId: { not: 'u1' },
        readBy: { none: { userId: 'u1' } },
      },
    });
  });

  it('getUserChats unreadCount and getChat unreadCount can match same snapshot', async () => {
    prisma.chat.findMany.mockResolvedValue([
      {
        id: 'chat-1',
        createdAt: new Date(),
        lastMessageAt: new Date(),
        lastMessage: null,
        event: {
          id: 'event-1',
          eventName: 'Event',
          category: 'SPORT',
          visibility: 'PUBLIC',
          status: 'ACTIVE',
          creatorId: 'u2',
          date: new Date(),
          startTime: null,
          endTime: null,
          isAllDay: false,
          creator: { id: 'u2', username: 'owner', avatar: null },
          _count: { participants: 2 },
        },
        _count: { messages: 5 },
      },
    ]);
    prisma.message.groupBy.mockResolvedValue([{ chatId: 'chat-1', _count: { id: 2 } }]);
    jest.spyOn(service, 'getMessages').mockResolvedValue({
      messages: [],
      nextCursor: null,
      hasMore: false,
    });
    jest.spyOn(service, 'getUnreadCount').mockResolvedValue(2);
    jest.spyOn(service as any, 'checkAccess').mockResolvedValue('event-1');
    prisma.chat.findUnique.mockResolvedValue({
      id: 'chat-1',
      event: { id: 'event-1', eventName: 'Event', status: 'ACTIVE', participants: [] },
    });

    const [list, detail] = await Promise.all([
      service.getUserChats('u1'),
      service.getChat('chat-1', 'u1', 50),
    ]);

    expect(list[0].unreadCount).toBe(2);
    expect(detail.unreadCount).toBe(2);
  });

  it('markChatAsReadWithDetails returns message ids and shared readAt timestamp', async () => {
    prisma.message.findMany.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);
    prisma.messageRead.createMany.mockResolvedValue({ count: 2 });

    const result = await service.markChatAsReadWithDetails('chat-1', 'u1');

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(result.messageIds).toEqual(['m1', 'm2']);
    expect(result.readAt).toBeInstanceOf(Date);
    expect(prisma.messageRead.createMany).toHaveBeenCalledWith({
      data: [
        { messageId: 'm1', userId: 'u1', readAt: expect.any(Date) },
        { messageId: 'm2', userId: 'u1', readAt: expect.any(Date) },
      ],
      skipDuplicates: true,
    });
  });

  it('getMessageReaders returns users with id, username, avatar and readAt', async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 'm1',
      chatId: 'chat-1',
      senderId: 'sender-1',
    });
    jest.spyOn(service as any, 'checkAccess').mockResolvedValue('event-1');
    prisma.messageRead.findMany.mockResolvedValue([
      {
        userId: 'u2',
        readAt: new Date('2026-01-01T12:00:00.000Z'),
        user: { id: 'u2', username: 'nick', avatar: 'https://avatar' },
      },
    ]);

    const result = await service.getMessageReaders('m1', 'u1');

    expect(prisma.messageRead.findMany).toHaveBeenCalledWith({
      where: { messageId: 'm1', userId: { not: 'sender-1' } },
      orderBy: { readAt: 'asc' },
      select: {
        userId: true,
        readAt: true,
        user: { select: { id: true, username: true, avatar: true } },
      },
    });
    expect(result).toEqual({
      messageId: 'm1',
      readers: [
        {
          userId: 'u2',
          username: 'nick',
          avatar: 'https://avatar',
          readAt: new Date('2026-01-01T12:00:00.000Z'),
        },
      ],
    });
  });
});
