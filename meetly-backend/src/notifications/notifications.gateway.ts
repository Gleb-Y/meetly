import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

interface JwtPayload {
  sub: string;
  [key: string]: any;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/notifications',
  transports: ['websocket', 'polling'],
  pingInterval: 25_000,
  pingTimeout: 20_000,
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server: Namespace;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);

      if (!token) {
        this.logger.warn(
          `Connection rejected: no token provided (socket=${client.id})`,
        );
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<JwtPayload>(token);
      const userId = payload.sub;

      client.data.userId = userId;
      await client.join(this.getUserRoom(userId));

      this.logger.debug(`User connected: ${userId} (socket=${client.id})`);
    } catch (error) {
      this.logger.warn(
        `Connection rejected: invalid token (socket=${client.id})`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  /**
   * Отправить уведомление конкретному пользователю.
   */
  sendToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(this.getUserRoom(userId)).emit(event, payload);
    this.logger.debug(`Notification sent to user ${userId}: ${event}`);
  }

  /**
   * Отправить payload всем подключённым клиентам namespace `/notifications`.
   * Используется для лёгких сигналов вроде «обнови ленту карты» (без FCM).
   * На нескольких инстансах без общего Socket.IO adapter доставит только сокеты этого процесса.
   */
  broadcastNotification(event: string, payload: unknown): void {
    this.server.emit(event, payload);
    this.logger.debug(`Notification broadcast to all: ${event}`);
  }

  /**
   * Проверить, подключён ли пользователь к notifications namespace.
   * Использует внутреннее состояние адаптера Socket.IO, избегая дублирования стейта.
   */
  isUserOnline(userId: string): boolean {
    const rooms = this.server.adapter?.rooms;
    if (!rooms) return false;
    const room = rooms.get(this.getUserRoom(userId));
    return !!room && room.size > 0;
  }

  /**
   * Число пользователей с хотя бы одним подключённым сокетом к namespace `/notifications`.
   * Считает комнаты `user:<id>` в адаптере (in-memory; при горизонтальном масштабе — только этот процесс).
   *
   * Для namespaced gateway `this.server` — Namespace; комнаты в `adapter.rooms`, не в `sockets.adapter`.
   */
  countOnlineNotificationUsers(): number {
    const rooms = this.server.adapter?.rooms;
    if (!rooms) return 0;
    let n = 0;
    for (const [roomName, socketIds] of rooms) {
      if (roomName.startsWith('user:') && socketIds.size > 0) {
        n += 1;
      }
    }
    return n;
  }

  private extractToken(client: Socket): string | undefined {
    const { auth, query } = client.handshake;
    return (auth?.token as string) ?? (query?.token as string);
  }

  private getUserRoom(userId: string): string {
    return `user:${userId}`;
  }
}
