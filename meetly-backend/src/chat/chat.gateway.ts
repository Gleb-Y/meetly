import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ChatService,
  DeletedMessageResult,
  EditedMessageResult,
} from './chat.service';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';

// Расширяем Socket для типизации data
interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    [key: string]: unknown;
  };
}

// Типы для WebSocket событий
interface SendMessagePayload {
  chatId: string;
  content: string;
  replyToId?: string;
  imageUrl?: string;
  audioUrl?: string;
  audioDurationMs?: number;
  audioMimeType?: string;
  audioSizeBytes?: number;
  tempId?: string;
}

interface EditMessagePayload {
  messageId: string;
  content: string;
}

interface DeleteMessagePayload {
  messageId: string;
}

interface ReactionTogglePayload {
  messageId: string;
  emoji: string;
}

interface JoinChatPayload {
  chatId: string;
}

interface SubscribeToChatsPayload {
  chatIds: string[];
}

interface GetMessageReadersPayload {
  messageId: string;
}

// Онлайн-статус пользователей
class OnlineTracker {
  private readonly chatUsers = new Map<string, Set<string>>(); // chatId -> userIds
  private readonly userSockets = new Map<string, Set<string>>(); // userId -> socketIds
  private readonly socketChats = new Map<string, Set<string>>(); // socketId -> chatIds

  join(socketId: string, userId: string, chatId: string): boolean {
    const userSockets = this.userSockets.get(userId) ?? new Set();
    userSockets.add(socketId);
    this.userSockets.set(userId, userSockets);

    const socketChats = this.socketChats.get(socketId) ?? new Set();
    socketChats.add(chatId);
    this.socketChats.set(socketId, socketChats);

    const chatUsers = this.chatUsers.get(chatId) ?? new Set();
    const isFirstInChat = !chatUsers.has(userId);
    chatUsers.add(userId);
    this.chatUsers.set(chatId, chatUsers);

    return isFirstInChat;
  }

  leave(socketId: string, userId: string, chatId: string): boolean {
    this.socketChats.get(socketId)?.delete(chatId);

    // Check if user has other sockets in this chat
    const userSockets = this.userSockets.get(userId);
    if (userSockets) {
      for (const sid of userSockets) {
        if (sid !== socketId && this.socketChats.get(sid)?.has(chatId)) {
          return false; // user still in chat via another socket
        }
      }
    }

    this.chatUsers.get(chatId)?.delete(userId);
    return true; // user fully left chat
  }

  disconnect(socketId: string, userId: string): string[] {
    const leftChats: string[] = [];
    const chats = this.socketChats.get(socketId);

    if (chats) {
      for (const chatId of chats) {
        if (this.leave(socketId, userId, chatId)) {
          leftChats.push(chatId);
        }
      }
    }

    this.socketChats.delete(socketId);
    this.userSockets.get(userId)?.delete(socketId);
    if (this.userSockets.get(userId)?.size === 0) {
      this.userSockets.delete(userId);
    }

    return leftChats;
  }

  getOnlineUsers(chatId: string): string[] {
    return Array.from(this.chatUsers.get(chatId) ?? []);
  }

  /** Уникальные пользователи, у которых есть хотя бы один `joinChat` (presence) в любом чате. */
  countUniqueUsersWithPresence(): number {
    const seen = new Set<string>();
    for (const userSet of this.chatUsers.values()) {
      for (const uid of userSet) seen.add(uid);
    }
    return seen.size;
  }
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/chat',
  transports: ['polling', 'websocket'], // Polling first (more reliable on mobile HTTP)
  pingInterval: 30000,
  pingTimeout: 60000, // Longer timeout for mobile networks
  allowEIO3: true, // Support Socket.io v2 & v3
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly tracker = new OnlineTracker();
  private readonly focusedChatBySocket = new Map<string, string>(); // socketId -> focused chatId
  /** userId -> socket ids: аутентифицированные сокеты namespace `/chat` (для админ-метрик). */
  private readonly chatNamespaceSockets = new Map<string, Set<string>>();

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Снимок для админки: подключения к `/chat` и пользователи в joinChat-presence.
   * In-memory; при нескольких инстансах сервера значения не суммируются.
   */
  getAdminRealtimeSnapshot(): {
    chatNamespace: {
      uniqueUsers: number;
      totalSockets: number;
    };
    joinChatPresence: { uniqueUsers: number };
  } {
    let totalSockets = 0;
    for (const sockets of this.chatNamespaceSockets.values()) {
      totalSockets += sockets.size;
    }
    return {
      chatNamespace: {
        uniqueUsers: this.chatNamespaceSockets.size,
        totalSockets,
      },
      joinChatPresence: {
        uniqueUsers: this.tracker.countUniqueUsersWithPresence(),
      },
    };
  }

  private registerChatNamespaceSocket(userId: string, socketId: string): void {
    let set = this.chatNamespaceSockets.get(userId);
    if (!set) {
      set = new Set();
      this.chatNamespaceSockets.set(userId, set);
    }
    set.add(socketId);
  }

  private unregisterChatNamespaceSocket(
    userId: string,
    socketId: string,
  ): void {
    const set = this.chatNamespaceSockets.get(userId);
    if (!set) return;
    set.delete(socketId);
    if (set.size === 0) {
      this.chatNamespaceSockets.delete(userId);
    }
  }

  private setFocusedChat(socketId: string, chatId: string): void {
    this.focusedChatBySocket.set(socketId, chatId);
  }

  private clearFocusedChat(socketId: string, chatId?: string): void {
    const currentChatId = this.focusedChatBySocket.get(socketId);
    if (!currentChatId) {
      return;
    }
    if (!chatId || chatId === currentChatId) {
      this.focusedChatBySocket.delete(socketId);
    }
  }

  private isSocketFocusedOnChat(socketId: string, chatId: string): boolean {
    return this.focusedChatBySocket.get(socketId) === chatId;
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token || client.handshake.query?.token;
      if (!token) {
        this.logger.warn(`Connection rejected: No token, socket=${client.id}`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      // Декодируем токен и устанавливаем userId
      const payload = this.jwtService.verify(token as string);
      const userId = payload.sub || payload.id;

      if (!userId) {
        this.logger.warn(
          `Connection rejected: Invalid token payload, socket=${client.id}`,
        );
        client.emit('error', { message: 'Invalid token' });
        client.disconnect();
        return;
      }

      client.data.userId = userId;
      this.registerChatNamespaceSocket(userId, client.id);
      this.logger.debug(
        `Client connected: socket=${client.id}, userId=${userId}`,
      );
    } catch (error) {
      this.logger.warn(
        `Connection rejected: ${error.message}, socket=${client.id}`,
      );
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    const focusedChatId = this.focusedChatBySocket.get(client.id);
    this.clearFocusedChat(client.id);
    if (userId) {
      this.unregisterChatNamespaceSocket(userId, client.id);
      const leftChats = this.tracker.disconnect(client.id, userId);
      for (const chatId of leftChats) {
        this.server
          .to(`chat:${chatId}`)
          .emit('userOffline', { userId, chatId });
      }
      this.logger.debug(
        `Disconnect cleanup: socket=${client.id}, userId=${userId}, focusedChat=${focusedChatId ?? 'none'}, leftChats=${leftChats.join(',') || 'none'}`,
      );
    }
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('joinChat')
  async handleJoinChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() { chatId }: JoinChatPayload,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Проверяем доступ к чату по chatId, а не по eventId
      await this.chatService.getChat(chatId, userId, 0);

      client.join(`chat:${chatId}`);
      this.setFocusedChat(client.id, chatId);
      if (this.tracker.join(client.id, userId, chatId)) {
        client.to(`chat:${chatId}`).emit('userOnline', { userId, chatId });
      }
      console.log(`User ${userId} joined room ${chatId}`);
      this.logger.debug(`User ${userId} joined chat:${chatId}`);
      return {
        success: true,
        onlineUsers: this.tracker.getOnlineUsers(chatId),
      };
    } catch (e) {
      this.logger.error(`joinChat error: ${e.message}`);
      return { success: false, error: e.message };
    }
  }

  /**
   * Подписаться на обновления списка чатов (для получения сообщений в фоне)
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('subscribeToChats')
  async handleSubscribeToChats(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() { chatIds }: SubscribeToChatsPayload,
  ) {
    const userId = client.data.userId;
    if (!userId) return { success: false };

    const rooms = chatIds.map((id) => `chat:${id}`);
    await client.join(rooms);

    this.logger.debug(`User ${userId} subscribed to ${chatIds.length} chats`);
    return { success: true, count: chatIds.length };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leaveChat')
  async handleLeaveChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() { chatId }: JoinChatPayload,
  ) {
    const userId = client.data.userId;
    if (!userId) return { success: false };

    await client.leave(`chat:${chatId}`);
    this.clearFocusedChat(client.id, chatId);
    if (this.tracker.leave(client.id, userId, chatId)) {
      this.server.to(`chat:${chatId}`).emit('userOffline', { userId, chatId });
    }
    console.log(`User ${userId} left room ${chatId}`);
    return { success: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SendMessagePayload,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const message = await this.chatService.sendMessage(
        data.chatId,
        userId,
        data.content,
        data.replyToId,
        data.imageUrl,
        data.audioUrl,
        data.audioDurationMs,
        data.audioMimeType,
        data.audioSizeBytes,
      );

      const room = this.server.in(`chat:${data.chatId}`);
      const sockets = await room.fetchSockets();
      const recipientIds = Array.from(
        new Set(
          sockets
            .map(
              (socket) =>
                (socket.data as { userId?: string } | undefined)?.userId,
            )
            .filter((id): id is string => id !== undefined),
        ),
      );
      const readByRecipients = await this.chatService.getMessageReadUsers(
        message.id,
        recipientIds,
      );
      const senderHasFocusedRecipient = sockets.some((socket) => {
        const recipientId = (socket.data as { userId?: string } | undefined)
          ?.userId;
        if (!recipientId || recipientId === userId) {
          return false;
        }
        return this.isSocketFocusedOnChat(socket.id, data.chatId);
      });

      for (const socket of sockets) {
        const recipientId = (socket.data as { userId?: string } | undefined)
          ?.userId;
        if (!recipientId) {
          continue;
        }

        socket.emit('newMessage', {
          ...message,
          tempId: data.tempId,
          isRead:
            recipientId === userId
              ? senderHasFocusedRecipient
              : readByRecipients.has(recipientId),
        });
      }

      this.logger.debug(`Message sent to chat:${data.chatId}`);
      return { success: true, message };
    } catch (error) {
      this.logger.error(`sendMessage error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() { chatId }: { chatId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return { success: false };
    if (!this.isSocketFocusedOnChat(client.id, chatId)) {
      return { success: false, error: 'Chat is not focused' };
    }

    try {
      const result = await this.chatService.markChatAsReadWithDetails(
        chatId,
        userId,
      );
      // Уведомляем других участников, что пользователь прочитал
      client.to(`chat:${chatId}`).emit('messagesRead', { userId, chatId });
      if (result.messageIds.length > 0 && result.readAt) {
        const reader = await this.chatService.getChatUserPreview(userId);
        client.to(`chat:${chatId}`).emit('messageReadUpdate', {
          chatId,
          reader,
          messageIds: result.messageIds,
          readAt: result.readAt,
        });
      }

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('getMessageReaders')
  async handleGetMessageReaders(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: GetMessageReadersPayload,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const result = await this.chatService.getMessageReaders(
        payload.messageId,
        userId,
      );
      client.emit('messageReaders', result);
      return { success: true, ...result };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to get message readers';
      return { success: false, error: errorMessage };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('editMessage')
  async handleEditMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: EditMessagePayload,
  ) {
    const userId = client.data.userId;
    if (!userId) return { success: false, error: 'Not authenticated' };

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const message = (await this.chatService.editMessage(
        data.messageId,
        userId,
        data.content,
      )) as EditedMessageResult;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.server.to(`chat:${message.chatId}`).emit('messageUpdated', message);
      return { success: true, message };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to edit message';
      return { success: false, error: errorMessage };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: DeleteMessagePayload,
  ) {
    const userId = client.data.userId;
    if (!userId) return { success: false, error: 'Not authenticated' };

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const result = (await this.chatService.deleteMessage(
        data.messageId,
        userId,
      )) as DeletedMessageResult;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.server.to(`chat:${result.chatId}`).emit('messageDeleted', result);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to delete message';
      return { success: false, error: errorMessage };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('reaction')
  async handleReaction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: ReactionTogglePayload,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const result = await this.chatService.toggleReaction(
        data.messageId,
        userId,
        data.emoji,
      );
      const { reaction, action, chatId } = result;
      const user = reaction.user;
      const payload: {
        messageId: string;
        emoji: string;
        userId: string;
        action: typeof action;
        previousEmoji?: string;
        user?: { id: string; username: string | null; avatar: string | null };
      } = {
        messageId: data.messageId,
        emoji: reaction.emoji,
        userId: reaction.userId,
        action,
        user: user
          ? {
              id: user.id,
              username: user.username,
              avatar: user.avatar,
            }
          : undefined,
      };
      if (action === 'replaced' && 'previousEmoji' in result) {
        payload.previousEmoji = result.previousEmoji;
      }
      this.server.to(`chat:${chatId}`).emit('reactionUpdated', payload);
      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to toggle reaction';
      return { success: false, error: errorMessage };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() { chatId }: { chatId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    client.to(`chat:${chatId}`).emit('userTyping', { userId, chatId });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('stopTyping')
  async handleStopTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() { chatId }: { chatId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    client.to(`chat:${chatId}`).emit('userStopTyping', { userId, chatId });
  }

  async broadcastSystemMessage(
    chatId: string,
    senderId: string,
    content: string,
  ) {
    const message = await this.chatService.sendSystemMessage(
      chatId,
      senderId,
      content,
    );
    const room = this.server.in(`chat:${chatId}`);
    const sockets = await room.fetchSockets();
    const recipientIds = Array.from(
      new Set(
        sockets
          .map(
            (socket) => (socket.data as { userId?: string } | undefined)?.userId,
          )
          .filter((id): id is string => id !== undefined),
      ),
    );
    const readByRecipients = await this.chatService.getMessageReadUsers(
      message.id,
      recipientIds,
    );
    const senderHasFocusedRecipient = sockets.some((socket) => {
      const recipientId = (socket.data as { userId?: string } | undefined)
        ?.userId;
      if (!recipientId || recipientId === senderId) {
        return false;
      }
      return this.isSocketFocusedOnChat(socket.id, chatId);
    });

    for (const socket of sockets) {
      const recipientId = (socket.data as { userId?: string } | undefined)
        ?.userId;
      if (!recipientId) {
        continue;
      }

      socket.emit('newMessage', {
        ...message,
        isRead:
          recipientId === senderId
            ? senderHasFocusedRecipient
            : readByRecipients.has(recipientId),
      });
    }
    return message;
  }
}
