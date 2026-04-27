import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const token =
      client.handshake?.auth?.token || client.handshake?.query?.token;

    if (!token) {
      throw new WsException('Unauthorized: Token missing');
    }

    try {
      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub || payload.id;
      client.data.phoneNumber = payload.phoneNumber;
      return true;
    } catch (error) {
      this.logger.error(`WS Auth error: ${error.message}`);
      throw new WsException('Unauthorized: Invalid token');
    }
  }
}
