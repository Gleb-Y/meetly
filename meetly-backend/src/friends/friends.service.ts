import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FriendRequestStatus } from '@prisma/client';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PUSH_POLICY, PushType } from '../notifications/push.types';
import { v7 as uuidv7 } from 'uuid';

export enum NotificationType {
  FRIEND_REQUEST = 'FRIEND_REQUEST',
  FRIEND_REQUEST_ACCEPTED = 'FRIEND_REQUEST_ACCEPTED',
  FRIEND_REQUEST_REJECTED = 'FRIEND_REQUEST_REJECTED',
  FRIEND_REQUEST_CANCELLED = 'FRIEND_REQUEST_CANCELLED',
  FRIEND_REMOVED = 'FRIEND_REMOVED',
}

const USER_SELECT = {
  id: true,
  username: true,
  avatar: true,
} as const;

const FRIEND_REQUEST_INCLUDE = {
  sender: { select: USER_SELECT },
  receiver: { select: USER_SELECT },
} as const;

@Injectable()
export class FriendsService {
  private readonly logger = new Logger(FriendsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationDispatcher: NotificationDispatcherService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async sendFriendRequest(senderId: string, receiverId: string) {
    if (senderId === receiverId) {
      throw new BadRequestException('Нельзя отправить запрос самому себе');
    }

    const receiver = await this.prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true, isActive: true },
    });

    if (!receiver?.isActive) {
      throw new NotFoundException('Пользователь не найден');
    }

    const existingFriendship = await this.prisma.friendship.findUnique({
      where: { userId_friendId: { userId: senderId, friendId: receiverId } },
    });

    if (existingFriendship) {
      throw new ConflictException('Вы уже друзья с этим пользователем');
    }

    const pendingRequest = await this.prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId, receiverId, status: FriendRequestStatus.PENDING },
          {
            senderId: receiverId,
            receiverId: senderId,
            status: FriendRequestStatus.PENDING,
          },
        ],
      },
    });

    if (pendingRequest) {
      // Встречный запрос — принимаем автоматически
      if (pendingRequest.senderId === receiverId) {
        return this.acceptFriendRequest(pendingRequest.id, senderId);
      }
      throw new ConflictException('Запрос в друзья уже отправлен');
    }

    // Upsert: обновляем отклонённый или создаём новый
    const rejectedRequest = await this.prisma.friendRequest.findUnique({
      where: { senderId_receiverId: { senderId, receiverId } },
    });

    const friendRequest =
      rejectedRequest?.status === FriendRequestStatus.REJECTED
        ? await this.prisma.friendRequest.update({
            where: { id: rejectedRequest.id },
            data: { status: FriendRequestStatus.PENDING },
            include: FRIEND_REQUEST_INCLUDE,
          })
        : await this.prisma.friendRequest.create({
            data: { senderId, receiverId, status: FriendRequestStatus.PENDING },
            include: FRIEND_REQUEST_INCLUDE,
          });

    const notificationId = uuidv7();
    const friendRequestPayload = {
      type: PushType.FRIEND_REQUEST,
      notificationId,
      requestId: friendRequest.id,
      userId: receiverId,
      senderId: friendRequest.sender.id,
      senderName: friendRequest.sender.username ?? '',
      avatar: friendRequest.sender.avatar ?? '',
      timestamp: friendRequest.createdAt.toISOString(),
      title: 'Friend request',
      body: `${friendRequest.sender.username ?? 'Someone'} sent you a friend request`,
    };

    void this.notificationDispatcher
      .notifyUser(receiverId, friendRequestPayload, friendRequestPayload, {
        ...PUSH_POLICY[PushType.FRIEND_REQUEST],
        dedupeKey: `friend_request:${friendRequest.id}`,
      })
      .catch((error: Error) => {
        this.logger.error(
          `FRIEND_REQUEST push failed request=${friendRequest.id}: ${error.message}`,
        );
      });

    this.logger.log(
      `Friend request sent: ${senderId} -> ${receiverId} (id=${friendRequest.id})`,
    );

    return friendRequest;
  }

  async acceptFriendRequest(requestId: string, currentUserId: string) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
      include: FRIEND_REQUEST_INCLUDE,
    });

    if (!request) {
      throw new NotFoundException('Запрос в друзья не найден');
    }
    if (request.receiverId !== currentUserId) {
      throw new ForbiddenException(
        'Только получатель может принять запрос в друзья',
      );
    }
    if (request.status !== FriendRequestStatus.PENDING) {
      throw new BadRequestException('Запрос уже обработан');
    }

    const [updatedRequest] = await this.prisma.$transaction([
      this.prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: FriendRequestStatus.ACCEPTED },
        include: FRIEND_REQUEST_INCLUDE,
      }),
      this.prisma.friendship.create({
        data: { userId: request.senderId, friendId: request.receiverId },
      }),
      this.prisma.friendship.create({
        data: { userId: request.receiverId, friendId: request.senderId },
      }),
    ]);

    const acceptedAt = new Date().toISOString();
    this.notificationsGateway.sendToUser(request.senderId, 'notification', {
      type: NotificationType.FRIEND_REQUEST_ACCEPTED,
      requestId: updatedRequest.id,
      userId: updatedRequest.receiver.id,
      friendId: updatedRequest.receiver.id,
      acceptedByUserId: updatedRequest.receiver.id,
      userName: updatedRequest.receiver.username,
      avatar: updatedRequest.receiver.avatar,
      timestamp: acceptedAt,
    });

    this.logger.log(
      `Friend request accepted: ${request.senderId} <-> ${request.receiverId}`,
    );

    return updatedRequest;
  }

  async rejectFriendRequest(requestId: string, currentUserId: string) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Запрос в друзья не найден');
    }
    if (request.receiverId !== currentUserId) {
      throw new ForbiddenException(
        'Только получатель может отклонить запрос в друзья',
      );
    }
    if (request.status !== FriendRequestStatus.PENDING) {
      throw new BadRequestException('Запрос уже обработан');
    }

    const updated = await this.prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: FriendRequestStatus.REJECTED },
    });

    this.logger.log(
      `Friend request rejected: ${request.senderId} -> ${request.receiverId}`,
    );

    return updated;
  }

  async cancelFriendRequest(requestId: string, currentUserId: string) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Запрос в друзья не найден');
    }
    if (request.senderId !== currentUserId) {
      throw new ForbiddenException('Только отправитель может отменить запрос');
    }
    if (request.status !== FriendRequestStatus.PENDING) {
      throw new BadRequestException('Запрос уже обработан');
    }

    const { senderId, receiverId } = request;
    await this.prisma.friendRequest.delete({ where: { id: requestId } });

    this.notificationsGateway.sendToUser(receiverId, 'notification', {
      type: NotificationType.FRIEND_REQUEST_CANCELLED,
      requestId,
      senderId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Friend request cancelled: ${senderId} -> ${receiverId}`);

    return { success: true };
  }

  async removeFriend(userId: string, friendId: string) {
    if (userId === friendId) {
      throw new BadRequestException('Некорректный запрос');
    }

    const friendship = await this.prisma.friendship.findUnique({
      where: { userId_friendId: { userId, friendId } },
    });

    if (!friendship) {
      throw new NotFoundException('Пользователь не в списке друзей');
    }

    await this.prisma.$transaction([
      this.prisma.friendship.deleteMany({
        where: {
          OR: [
            { userId, friendId },
            { userId: friendId, friendId: userId },
          ],
        },
      }),
      this.prisma.friendRequest.deleteMany({
        where: {
          OR: [
            { senderId: userId, receiverId: friendId },
            { senderId: friendId, receiverId: userId },
          ],
        },
      }),
    ]);

    this.notificationsGateway.sendToUser(friendId, 'notification', {
      type: NotificationType.FRIEND_REMOVED,
      userId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Friendship removed: ${userId} <-> ${friendId}`);

    return { success: true };
  }

  async getFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: { userId },
      include: {
        friend: {
          select: { ...USER_SELECT, bio: true, isActive: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return friendships.map(({ id, createdAt, friend }) => ({
      friendshipId: id,
      friendsSince: createdAt,
      ...friend,
    }));
  }

  /**
   * Список друзей пользователя `targetUserId` для зрителя `viewerId`.
   * Формат как у {@link getFriends}; при скрытии по приватности — [] (как mutual).
   */
  async getFriendsOfUser(viewerId: string, targetUserId: string) {
    if (viewerId === targetUserId) {
      return this.getFriends(viewerId);
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        isActive: true,
        showFriendsInProfile: true,
        isProfileClosed: true,
      },
    });

    if (!target?.isActive) {
      throw new NotFoundException('Пользователь не найден');
    }

    const isFriend = await this.areFriends(viewerId, targetUserId);

    if (!target.showFriendsInProfile) {
      return [];
    }
    if (target.isProfileClosed && !isFriend) {
      return [];
    }

    return this.getFriends(targetUserId);
  }

  async getIncomingRequests(userId: string) {
    return this.prisma.friendRequest.findMany({
      where: { receiverId: userId, status: FriendRequestStatus.PENDING },
      include: { sender: { select: USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOutgoingRequests(userId: string) {
    return this.prisma.friendRequest.findMany({
      where: { senderId: userId, status: FriendRequestStatus.PENDING },
      include: { receiver: { select: USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFriendshipStatus(
    currentUserId: string,
    targetUserId: string,
  ): Promise<{
    status: 'friends' | 'pending_incoming' | 'pending_outgoing' | 'none';
    requestId?: string;
  }> {
    const friendship = await this.prisma.friendship.findUnique({
      where: {
        userId_friendId: { userId: currentUserId, friendId: targetUserId },
      },
    });

    if (friendship) return { status: 'friends' };

    const request = await this.prisma.friendRequest.findFirst({
      where: {
        OR: [
          {
            senderId: currentUserId,
            receiverId: targetUserId,
            status: FriendRequestStatus.PENDING,
          },
          {
            senderId: targetUserId,
            receiverId: currentUserId,
            status: FriendRequestStatus.PENDING,
          },
        ],
      },
    });

    if (!request) return { status: 'none' };

    return request.senderId === currentUserId
      ? { status: 'pending_outgoing', requestId: request.id }
      : { status: 'pending_incoming', requestId: request.id };
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const friendship = await this.prisma.friendship.findUnique({
      where: { userId_friendId: { userId: userId1, friendId: userId2 } },
    });

    return !!friendship;
  }

  async getMutualFriends(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) {
      return [];
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        isActive: true,
        showFriendsInProfile: true,
        isProfileClosed: true,
      },
    });

    if (!target?.isActive) {
      throw new NotFoundException('Пользователь не найден');
    }

    const isFriend = await this.areFriends(currentUserId, targetUserId);

    // Док: пусто, если владелец скрыл друзей (зритель здесь всегда не владелец — self обработан выше),
    // или профиль закрыт и зритель не друг.
    if (!target.showFriendsInProfile) {
      return [];
    }
    if (target.isProfileClosed && !isFriend) {
      return [];
    }

    const [currentFriendIds, targetFriendIds] = await Promise.all([
      this.prisma.friendship.findMany({
        where: { userId: currentUserId },
        select: { friendId: true },
      }),
      this.prisma.friendship.findMany({
        where: { userId: targetUserId },
        select: { friendId: true },
      }),
    ]);

    const currentSet = new Set(currentFriendIds.map((f) => f.friendId));
    const mutualIds = targetFriendIds
      .map((f) => f.friendId)
      .filter((id) => currentSet.has(id));

    if (mutualIds.length === 0) {
      return [];
    }

    return this.prisma.user.findMany({
      where: { id: { in: mutualIds }, isActive: true },
      select: USER_SELECT,
    });
  }
}
