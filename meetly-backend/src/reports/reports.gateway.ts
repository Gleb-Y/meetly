import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

const MODERATION_ROOM = 'admin:reports';

interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
    [key: string]: unknown;
  };
}

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/reports',
  transports: ['websocket', 'polling'],
  pingInterval: 25_000,
  pingTimeout: 20_000,
})
export class ReportsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ReportsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify<{ sub: string }>(token);
      client.data.userId = payload.sub;
      this.logger.debug(`Reports client connected: ${client.id}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Reports client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinModeration')
  async handleJoinModeration(
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<{ success: boolean; error?: string }> {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!this.isAdmin(userId)) {
      return { success: false, error: 'Access denied' };
    }

    await client.join(MODERATION_ROOM);
    this.logger.debug(`Admin ${userId} joined moderation room`);
    return { success: true };
  }

  broadcastNewReport(report: {
    id: string;
    reporterId: string;
    targetUserId: string;
    eventId: string | null;
    reason: string;
    description: string | null;
    status: string;
    createdAt: Date;
    reporter: { id: string; username: string | null };
    targetUser: { id: string; username: string | null };
    event: { id: string; eventName: string } | null;
  }) {
    this.server.to(MODERATION_ROOM).emit('newReport', {
      id: report.id,
      reporterId: report.reporterId,
      targetUserId: report.targetUserId,
      eventId: report.eventId,
      reason: report.reason,
      description: report.description,
      status: report.status,
      createdAt: report.createdAt,
      reporter: report.reporter,
      targetUser: report.targetUser,
      event: report.event,
    });
    this.logger.debug(`Broadcast newReport to moderation room`);
  }

  broadcastReportHandled(
    reportId: string,
    status: 'resolved' | 'dismissed',
    targetUserId: string,
  ) {
    this.server.to(MODERATION_ROOM).emit('reportHandled', {
      reportId,
      status,
      targetUserId,
    });
  }

  broadcastAdminAlert(payload: {
    type: string;
    userId: string;
    reportCount?: number;
    priority?: string;
    reason?: string;
    bannedUntil?: string;
  }) {
    this.server.to(MODERATION_ROOM).emit('adminAlert', payload);
  }

  private extractToken(client: Socket): string | undefined {
    const { auth, query } = client.handshake;
    return (auth?.token as string) ?? (query?.token as string);
  }

  private isAdmin(userId: string): boolean {
    const adminIds = this.configService.get<string>('ADMIN_USER_IDS')?.split(',') ?? [];
    return adminIds.map((id) => id.trim()).includes(userId);
  }
}
