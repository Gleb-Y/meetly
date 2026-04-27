import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_ORGANIZER_CHECK_IN_EARLY_MINUTES,
  getOrganizerMarkAttendanceUi,
} from '../events/event-time.helpers';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
import { PUSH_POLICY, PushType } from '../notifications/push.types';
import { v7 as uuidv7 } from 'uuid';

// Типы для ответов - экспортируем для использования в контроллере
export interface MessageWithDetails {
  id: string;
  content: string;
  imageUrl: string | null;
  audioUrl: string | null;
  audioDurationMs: number | null;
  audioMimeType: string | null;
  audioSizeBytes: number | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  isEdited: boolean;
  senderId: string;
  replyToId: string | null;
  sender: {
    id: string;
    username: string | null;
    avatar: string | null;
  };
  replyTo?: {
    id: string;
    content: string;
    imageUrl: string | null;
    audioUrl: string | null;
    audioDurationMs: number | null;
    senderId: string;
    sender: {
      id: string;
      username: string | null;
    };
  } | null;
  /** По каждому emoji: счётчик, id пользователей и превью для аватарок (сортировка по userId). */
  reactions: Array<{
    emoji: string;
    count: number;
    userIds: string[];
    reactors: Array<{
      id: string;
      username: string | null;
      avatar: string | null;
    }>;
    hasReacted: boolean;
  }>;
  isRead: boolean;
  readByCount: number;
}

export interface EditedMessageResult extends MessageWithDetails {
  chatId: string;
}

export interface DeletedMessageResult {
  success: true;
  messageId: string;
  chatId: string;
}

export interface MessageReader {
  userId: string;
  username: string | null;
  avatar: string | null;
  readAt: Date;
}

export interface MessageReadersResult {
  messageId: string;
  readers: MessageReader[];
}

export interface ChatUserPreview {
  userId: string;
  username: string | null;
  avatar: string | null;
}

export interface MarkChatAsReadWithDetailsResult {
  success: true;
  count: number;
  messageIds: string[];
  readAt: Date | null;
}

interface MessageOwnership {
  id: string;
  chatId: string;
  senderId: string;
  isSystem: boolean;
  createdAt: Date;
}

const USER_SELECT = {
  id: true,
  username: true,
  avatar: true,
} as const;

// LRU Cache для проверки доступа (оптимизированная реализация)
class AccessCache {
  private readonly cache = new Map<
    string,
    { value: boolean; expires: number }
  >();
  private readonly TTL = 60_000;

  get(userId: string, chatId: string): boolean | null {
    const key = `${userId}:${chatId}`;
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  set(userId: string, chatId: string, value: boolean): void {
    if (this.cache.size >= 1000) this.cache.clear();
    this.cache.set(`${userId}:${chatId}`, {
      value,
      expires: Date.now() + this.TTL,
    });
  }

  invalidateChat(chatId: string): void {
    for (const key of this.cache.keys()) {
      if (key.endsWith(`:${chatId}`)) this.cache.delete(key);
    }
  }
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly accessCache = new AccessCache();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationDispatcher: NotificationDispatcherService,
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

  private messageWasEdited(createdAt: Date, updatedAt: Date): boolean {
    return updatedAt.getTime() > createdAt.getTime();
  }

  private buildMessageNotificationBody(params: {
    content: string;
    imageUrl?: string | null;
    audioUrl?: string | null;
  }): string {
    const normalized = params.content.trim();
    if (normalized.length > 0) return normalized;
    if (params.audioUrl) return '🎤 Voice message';
    if (params.imageUrl) return '📷 Photo';
    return 'New message';
  }

  private buildUnreadWhere(
    userId: string,
    extra: Prisma.MessageWhereInput = {},
  ): Prisma.MessageWhereInput {
    return {
      ...extra,
      senderId: { not: userId },
      readBy: { none: { userId } },
    };
  }

  private getUserMessageReadState(
    message: { senderId: string; readBy: Array<{ userId: string }> },
    userId: string,
  ): boolean {
    return (
      message.senderId === userId ||
      message.readBy.some((read) => read.userId === userId)
    );
  }

  private async getOwnedMessageOrThrow(
    messageId: string,
    userId: string,
  ): Promise<MessageOwnership> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        chatId: true,
        senderId: true,
        isSystem: true,
        createdAt: true,
      },
    });

    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can edit or delete only your messages');
    }
    if (message.isSystem) {
      throw new ForbiddenException(
        'System messages cannot be edited or deleted',
      );
    }

    return message;
  }

  /**
   * Быстрая проверка доступа к чату с кэшированием
   */
  private async checkAccess(chatId: string, userId: string): Promise<string> {
    const cached = this.accessCache.get(userId, chatId);
    if (cached === false)
      throw new ForbiddenException('Join event to access chat');

    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: {
        eventId: true,
        event: { select: { participants: { where: { userId }, take: 1 } } },
      },
    });

    if (!chat) throw new NotFoundException('Chat not found');
    const hasAccess = chat.event.participants.length > 0;
    this.accessCache.set(userId, chatId, hasAccess);

    if (!hasAccess) throw new ForbiddenException('Join event to access chat');
    return chat.eventId;
  }

  /**
   * Получить список всех чатов пользователя - ОПТИМИЗИРОВАНО
   */
  async getUserChats(userId: string) {
    this.logger.debug(`Getting chats for user ${userId}`);

    const chats = await this.prisma.chat.findMany({
      where: { event: { participants: { some: { userId } } } },
      select: {
        id: true,
        createdAt: true,
        lastMessageAt: true,
        lastMessage: {
          select: {
            id: true,
            content: true,
            imageUrl: true,
            audioUrl: true,
            audioDurationMs: true,
            createdAt: true,
            sender: { select: USER_SELECT },
          },
        },
        event: {
          select: {
            id: true,
            eventName: true,
            category: true,
            visibility: true,
            status: true,
            creatorId: true,
            date: true,
            startTime: true,
            endTime: true,
            isAllDay: true,
            creator: { select: USER_SELECT },
            _count: { select: { participants: true } },
          },
        },
        _count: { select: { messages: true } },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (!chats.length) return [];

    const unreadCounts = await this.prisma.message.groupBy({
      by: ['chatId'],
      where: this.buildUnreadWhere(userId, {
        chatId: { in: chats.map((c) => c.id) },
      }),
      _count: { id: true },
    });

    const unreadMap = new Map(unreadCounts.map((u) => [u.chatId, u._count.id]));

    const now = new Date();

    return chats.map((chat) => ({
      id: chat.id,
      createdAt: chat.createdAt,
      lastMessageAt: chat.lastMessageAt,
      event: {
        ...chat.event,
        title: chat.event.eventName,
        isPrivate: chat.event.visibility === 'PRIVATE',
        isCompleted: chat.event.status === 'COMPLETED',
        organizerAttendanceUi: getOrganizerMarkAttendanceUi({
          viewerId: userId,
          creatorId: chat.event.creatorId,
          status: chat.event.status,
          date: chat.event.date,
          startTime: chat.event.startTime,
          endTime: chat.event.endTime,
          now,
          earlyMinutes: this.organizerCheckInEarlyMinutes(),
        }),
      },
      lastMessage: chat.lastMessage
        ? {
            ...chat.lastMessage,
            sender: {
              ...chat.lastMessage.sender,
              username: chat.lastMessage.sender.username,
              avatar: chat.lastMessage.sender.avatar,
            },
          }
        : null,
      unreadCount: unreadMap.get(chat.id) ?? 0,
    }));
  }

  /**
   * Получить сообщения чата с cursor-based пагинацией
   * Гораздо быстрее чем offset на больших данных
   */
  async getMessages(
    chatId: string,
    userId: string,
    limit = 50,
    cursor?: string,
    direction: 'older' | 'newer' = 'older',
  ) {
    await this.checkAccess(chatId, userId);

    const messages = await this.prisma.message.findMany({
      where: { chatId },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: { createdAt: direction === 'older' ? 'desc' : 'asc' },
      include: {
        sender: { select: USER_SELECT },
        replyTo: {
          include: { sender: { select: { id: true, username: true } } },
        },
        reactions: {
          select: {
            emoji: true,
            userId: true,
            user: { select: USER_SELECT },
          },
        },
        readBy: { select: { userId: true } },
        _count: { select: { readBy: true } },
      },
    });

    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;

    const transformed = resultMessages.map((msg) => ({
      ...msg,
      reactions: this.groupReactions(msg.reactions, userId),
      // Персонализированное прочтение для текущего пользователя.
      isRead: this.getUserMessageReadState(msg, userId),
      // Количество прочтений другими пользователями
      readByCount: msg.readBy.filter((r) => r.userId !== msg.senderId).length,
      isEdited: this.messageWasEdited(msg.createdAt, msg.updatedAt),
    }));

    if (direction === 'older') transformed.reverse();

    return {
      messages: transformed,
      nextCursor: hasMore ? resultMessages.at(-1)?.id : null,
      hasMore,
    };
  }

  private groupReactions(
    reactions: {
      emoji: string;
      userId: string;
      user: { id: string; username: string | null; avatar: string | null };
    }[],
    currentUserId: string,
  ) {
    const map = new Map<
      string,
      {
        emoji: string;
        pairs: Array<{
          userId: string;
          user: { id: string; username: string | null; avatar: string | null };
        }>;
        hasReacted: boolean;
      }
    >();
    reactions.forEach((r) => {
      const entry = map.get(r.emoji) ?? {
        emoji: r.emoji,
        pairs: [],
        hasReacted: false,
      };
      entry.pairs.push({ userId: r.userId, user: r.user });
      if (r.userId === currentUserId) entry.hasReacted = true;
      map.set(r.emoji, entry);
    });
    return Array.from(map.values()).map(({ emoji, pairs, hasReacted }) => {
      pairs.sort((a, b) => a.userId.localeCompare(b.userId));
      return {
        emoji,
        count: pairs.length,
        userIds: pairs.map((p) => p.userId),
        reactors: pairs.map((p) => ({
          id: p.user.id,
          username: p.user.username,
          avatar: p.user.avatar,
        })),
        hasReacted,
      };
    });
  }

  /**
   * Отправить сообщение - ОПТИМИЗИРОВАНО
   */
  async sendMessage(
    chatId: string,
    userId: string,
    content: string,
    replyToId?: string,
    imageUrl?: string,
    audioUrl?: string,
    audioDurationMs?: number,
    audioMimeType?: string,
    audioSizeBytes?: number,
  ) {
    await this.checkAccess(chatId, userId);

    const normalizedContent = content.trim();
    const hasImage = Boolean(imageUrl);
    const hasAudio = Boolean(audioUrl);
    if (!normalizedContent && !hasImage && !hasAudio) {
      throw new BadRequestException(
        'Message must contain text, image, or audio',
      );
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          chatId,
          senderId: userId,
          content: normalizedContent,
          replyToId,
          imageUrl,
          audioUrl,
          audioDurationMs,
          audioMimeType,
          audioSizeBytes,
        },
        include: {
          sender: { select: USER_SELECT },
          replyTo: {
            include: { sender: { select: { id: true, username: true } } },
          },
        },
      });

      await tx.chat.update({
        where: { id: chatId },
        data: { lastMessageId: message.id, lastMessageAt: message.createdAt },
      });
      await tx.messageRead.create({ data: { messageId: message.id, userId } });

      // Для отправителя возвращаем состояние "отправлено":
      // isRead: false (никто еще не прочитал), readByCount: 0 (кроме автора)
      return {
        ...message,
        reactions: [],
        isRead: false,
        readByCount: 0,
        isEdited: this.messageWasEdited(message.createdAt, message.updatedAt),
      };
    });

    const chatParticipants = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: {
        event: {
          select: {
            eventName: true,
            photoUrl: true,
            participants: { select: { userId: true } },
          },
        },
      },
    });

    const recipients =
      chatParticipants?.event.participants
        .map((p) => p.userId)
        .filter((participantId) => participantId !== userId) ?? [];

    const mutedRecipients =
      recipients.length > 0
        ? await this.prisma.chatUserSettings.findMany({
            where: {
              chatId,
              isMuted: true,
              userId: { in: recipients },
            },
            select: { userId: true },
          })
        : [];

    const mutedRecipientsSet = new Set(mutedRecipients.map((row) => row.userId));
    const notificationRecipients = recipients.filter(
      (recipientId) => !mutedRecipientsSet.has(recipientId),
    );

    if (notificationRecipients.length > 0) {
      const notificationId = uuidv7();
      const messageText = this.buildMessageNotificationBody({
        content: message.content,
        imageUrl: message.imageUrl,
        audioUrl: message.audioUrl,
      });
      const socketPayload = {
        type: PushType.CHAT_MESSAGE,
        notificationId,
        chatId,
        messageId: message.id,
        eventTitle: chatParticipants?.event.eventName,
        eventPhotoUrl: chatParticipants?.event.photoUrl ?? undefined,
        senderName: message.sender?.username ?? 'Unknown',
        messageText,
        chatName: chatParticipants?.event.eventName,
        body: messageText,
        title: 'New message',
      };

      void this.notificationDispatcher
        .notifyUsers(notificationRecipients, socketPayload, socketPayload, {
          ...PUSH_POLICY[PushType.CHAT_MESSAGE],
          dedupeKey: `chat:${message.id}`,
        })
        .catch((error: Error) =>
          this.logger.error(
            `CHAT_MESSAGE push failed chat=${chatId}: ${error.message}`,
          ),
        );
    }

    return message;
  }

  async editMessage(
    messageId: string,
    userId: string,
    content: string,
  ): Promise<EditedMessageResult> {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      throw new BadRequestException('Message content cannot be empty');
    }

    const message = await this.getOwnedMessageOrThrow(messageId, userId);
    await this.checkAccess(message.chatId, userId);

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { content: trimmedContent },
      include: {
        sender: { select: USER_SELECT },
        replyTo: {
          include: { sender: { select: { id: true, username: true } } },
        },
        reactions: {
          select: {
            emoji: true,
            userId: true,
            user: { select: USER_SELECT },
          },
        },
        readBy: { select: { userId: true } },
        _count: { select: { readBy: true } },
      },
    });

    return {
      ...updated,
      reactions: this.groupReactions(updated.reactions, userId),
      isRead: this.getUserMessageReadState(updated, userId),
      readByCount: updated.readBy.filter((r) => r.userId !== updated.senderId)
        .length,
      isEdited: this.messageWasEdited(updated.createdAt, updated.updatedAt),
    };
  }

  async deleteMessage(
    messageId: string,
    userId: string,
  ): Promise<DeletedMessageResult> {
    const message = await this.getOwnedMessageOrThrow(messageId, userId);
    await this.checkAccess(message.chatId, userId);

    return this.prisma.$transaction(async (tx) => {
      await tx.message.delete({ where: { id: messageId } });

      const chat = await tx.chat.findUnique({
        where: { id: message.chatId },
        select: { lastMessageId: true },
      });

      if (chat?.lastMessageId === messageId) {
        const previousMessage = await tx.message.findFirst({
          where: { chatId: message.chatId },
          orderBy: { createdAt: 'desc' },
          select: { id: true, createdAt: true },
        });

        await tx.chat.update({
          where: { id: message.chatId },
          data: {
            lastMessageId: previousMessage?.id ?? null,
            lastMessageAt: previousMessage?.createdAt ?? null,
          },
        });
      }

      return { success: true, messageId, chatId: message.chatId };
    });
  }

  /**
   * Добавить/убрать/заменить реакцию (toggle + replace)
   */
  async toggleReaction(messageId: string, userId: string, emoji: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { chatId: true },
    });
    if (!message) throw new NotFoundException('Message not found');
    await this.checkAccess(message.chatId, userId);

    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    });
    if (!actor) throw new NotFoundException('User not found');

    const withUser = (e: string) => ({
      emoji: e,
      userId,
      user: actor,
    });

    const existing = await this.prisma.reaction.findFirst({
      where: { messageId, userId },
    });

    if (existing && existing.emoji === emoji) {
      await this.prisma.reaction.delete({ where: { id: existing.id } });
      return {
        action: 'removed' as const,
        reaction: withUser(emoji),
        chatId: message.chatId,
      };
    }

    if (existing && existing.emoji !== emoji) {
      const previousEmoji = existing.emoji;
      await this.prisma.reaction.update({
        where: { id: existing.id },
        data: { emoji },
      });
      return {
        action: 'replaced' as const,
        reaction: withUser(emoji),
        previousEmoji,
        chatId: message.chatId,
      };
    }

    await this.prisma.reaction.create({ data: { messageId, userId, emoji } });
    return {
      action: 'added' as const,
      reaction: withUser(emoji),
      chatId: message.chatId,
    };
  }

  async getTotalUnreadCount(userId: string): Promise<number> {
    return this.prisma.message.count({
      where: this.buildUnreadWhere(userId, {
        chat: { event: { participants: { some: { userId } } } },
      }),
    });
  }

  async getChat(chatId: string, userId: string, limit: number) {
    await this.checkAccess(chatId, userId);
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        event: {
          select: {
            id: true,
            eventName: true,
            status: true,
            participants: { include: { user: { select: USER_SELECT } } },
          },
        },
      },
    });
    if (!chat) throw new NotFoundException('Chat not found');

    const [messagesData, unreadCount] = await Promise.all([
      this.getMessages(chatId, userId, limit),
      this.getUnreadCount(chatId, userId),
    ]);

    return { ...chat, ...messagesData, unreadCount };
  }

  async markChatAsRead(chatId: string, userId: string) {
    const result = await this.markChatAsReadWithDetails(chatId, userId);
    return { success: true, count: result.count };
  }

  async markChatAsReadWithDetails(
    chatId: string,
    userId: string,
  ): Promise<MarkChatAsReadWithDetailsResult> {
    const unread = await this.prisma.message.findMany({
      where: this.buildUnreadWhere(userId, { chatId }),
      select: { id: true },
    });

    const messageIds = unread.map((message) => message.id);
    const readAt = messageIds.length > 0 ? new Date() : null;

    if (unread.length > 0) {
      await this.prisma.messageRead.createMany({
        data: unread.map((message) => ({
          messageId: message.id,
          userId,
          readAt: readAt ?? undefined,
        })),
        skipDuplicates: true,
      });
    }

    return {
      success: true,
      count: unread.length,
      messageIds,
      readAt,
    };
  }

  async markMessagesAsRead(messageIds: string[], userId: string) {
    await this.prisma.messageRead.createMany({
      data: messageIds.map((id) => ({ messageId: id, userId })),
      skipDuplicates: true,
    });
    return { success: true };
  }

  async getUnreadCount(chatId: string, userId: string): Promise<number> {
    return this.prisma.message.count({
      where: this.buildUnreadWhere(userId, { chatId }),
    });
  }

  async getChatMuteStatus(chatId: string, userId: string) {
    await this.checkAccess(chatId, userId);

    const settings = await this.prisma.chatUserSettings.findUnique({
      where: { userId_chatId: { userId, chatId } },
      select: { isMuted: true },
    });

    return { chatId, isMuted: settings?.isMuted ?? false };
  }

  async setChatMuteStatus(chatId: string, userId: string, isMuted: boolean) {
    await this.checkAccess(chatId, userId);

    const settings = await this.prisma.chatUserSettings.upsert({
      where: { userId_chatId: { userId, chatId } },
      create: { userId, chatId, isMuted },
      update: { isMuted },
      select: { isMuted: true },
    });

    return { chatId, isMuted: settings.isMuted };
  }

  async getMessageReadUsers(
    messageId: string,
    userIds: string[],
  ): Promise<Set<string>> {
    if (!userIds.length) return new Set();

    const readRows = await this.prisma.messageRead.findMany({
      where: {
        messageId,
        userId: { in: userIds },
      },
      select: { userId: true },
    });

    return new Set(readRows.map((row) => row.userId));
  }

  async getMessageReaders(
    messageId: string,
    requesterId: string,
  ): Promise<MessageReadersResult> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, chatId: true, senderId: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.checkAccess(message.chatId, requesterId);

    const readers = await this.prisma.messageRead.findMany({
      where: {
        messageId,
        userId: { not: message.senderId },
      },
      orderBy: { readAt: 'asc' },
      select: {
        userId: true,
        readAt: true,
        user: { select: USER_SELECT },
      },
    });

    return {
      messageId,
      readers: readers.map((reader) => ({
        userId: reader.userId,
        username: reader.user.username,
        avatar: reader.user.avatar,
        readAt: reader.readAt,
      })),
    };
  }

  async getChatUserPreview(userId: string): Promise<ChatUserPreview> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      userId: user.id,
      username: user.username,
      avatar: user.avatar,
    };
  }

  async getMessageReactions(messageId: string, requesterId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { chatId: true },
    });
    if (!message) throw new NotFoundException('Message not found');
    await this.checkAccess(message.chatId, requesterId);

    const reactions = await this.prisma.reaction.findMany({
      where: { messageId },
      include: { user: { select: USER_SELECT } },
    });
    return reactions;
  }

  async getChatByIdChecked(chatId: string, userId: string) {
    await this.checkAccess(chatId, userId);
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException('Chat not found');
    return chat;
  }

  async getChatByEventId(eventId: string, userId: string) {
    const chat = await this.prisma.chat.findUnique({ where: { eventId } });
    if (!chat) throw new NotFoundException('Chat not found');
    await this.checkAccess(chat.id, userId);
    return chat;
  }

  async sendSystemMessage(chatId: string, userId: string, content: string) {
    return this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: { chatId, senderId: userId, content, isSystem: true },
        include: {
          sender: { select: USER_SELECT },
        },
      });

      await tx.messageRead.create({
        data: { messageId: message.id, userId },
      });

      await tx.chat.update({
        where: { id: chatId },
        data: { lastMessageId: message.id, lastMessageAt: message.createdAt },
      });

      return {
        ...message,
        replyTo: null,
        reactions: [],
        isRead: true,
        readByCount: 0,
        isEdited: this.messageWasEdited(message.createdAt, message.updatedAt),
      };
    });
  }

  async createChatForEvent(eventId: string) {
    return this.prisma.chat.create({ data: { eventId } });
  }
}
