import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushPlatform } from '@prisma/client';

@Injectable()
export class PushTokensService {
  private readonly logger = new Logger(PushTokensService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registerToken(userId: string, token: string, platform: PushPlatform) {
    const existing = await this.prisma.pushToken.findUnique({
      where: { token },
    });

    if (!existing) {
      await this.prisma.pushToken.create({
        data: {
          userId,
          token,
          platform,
          isActive: true,
          lastSeenAt: new Date(),
        },
      });

      this.logger.log(`Push token registered for user=${userId}`);
      return { success: true };
    }

    if (existing.userId !== userId) {
      this.logger.warn(
        `Push token rebind detected: token moved ${existing.userId} -> ${userId}`,
      );
    }

    await this.prisma.pushToken.update({
      where: { token },
      data: {
        userId,
        platform,
        isActive: true,
        lastSeenAt: new Date(),
        lastErrorAt: null,
        lastErrorCode: null,
      },
    });

    this.logger.log(`Push token upserted for user=${userId}`);
    return { success: true };
  }

  async deactivateToken(userId: string, token: string) {
    const updated = await this.prisma.pushToken.updateMany({
      where: { userId, token, isActive: true },
      data: { isActive: false },
    });

    this.logger.log(
      `Push token delete requested for user=${userId}, affected=${updated.count}`,
    );

    return { success: true };
  }
}
