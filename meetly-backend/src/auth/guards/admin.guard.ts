import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = req.user?.id;
    if (!userId) {
      throw new ForbiddenException('Access denied');
    }
    const adminIds =
      this.configService.get<string>('ADMIN_USER_IDS')?.split(',') ?? [];
    const normalized = adminIds.map((id) => id.trim()).filter(Boolean);
    if (!normalized.includes(userId)) {
      throw new ForbiddenException('Access denied');
    }
    return true;
  }
}
