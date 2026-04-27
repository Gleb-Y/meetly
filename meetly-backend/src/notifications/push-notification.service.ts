import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { v7 as uuidv7 } from 'uuid';
import { PushPayload, PushSendOptions } from './push.types';
import {
  buildFcmDisplayNotification,
  pushCorrelationSuffix,
} from './push-fcm-payload.util';
import * as admin from 'firebase-admin';

type SendResult = {
  successCount: number;
  failureCount: number;
};

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly dedupeCache = new Map<string, number>();
  private readonly app: admin.app.App | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.app = this.initFirebaseApp();
  }

  /** True when Firebase Admin credentials are loaded; false means push sends are no-ops. */
  isDeliveryConfigured(): boolean {
    return this.app !== null;
  }

  async sendToUser(
    userId: string,
    payload: PushPayload,
    options: PushSendOptions,
  ): Promise<SendResult> {
    return this.sendToUsers([userId], payload, options);
  }

  async sendToUsers(
    userIds: string[],
    payload: PushPayload,
    options: PushSendOptions,
  ): Promise<SendResult> {
    if (!this.app || userIds.length === 0) {
      if (userIds.length > 0 && !this.app) {
        this.logger.warn(
          `Push skip Firebase not configured userIds=[${userIds.join(',')}]${pushCorrelationSuffix(payload)}`,
        );
      }
      return { successCount: 0, failureCount: 0 };
    }

    if (options.dedupeKey && this.isDuplicate(options.dedupeKey)) {
      this.logger.debug(
        `Skip duplicated push send: ${options.dedupeKey}${pushCorrelationSuffix(payload)}`,
      );
      return { successCount: 0, failureCount: 0 };
    }

    const records = await this.prisma.pushToken.findMany({
      where: { userId: { in: userIds }, isActive: true },
      select: { token: true, userId: true },
    });

    if (records.length === 0) {
      this.logger.warn(
        `Push skip no active tokens type=${payload.type ?? 'UNKNOWN'} userIds=[${userIds.join(',')}]${pushCorrelationSuffix(payload)}`,
      );
      return { successCount: 0, failureCount: 0 };
    }

    const displayNotification = buildFcmDisplayNotification(payload);
    const message: admin.messaging.MulticastMessage = {
      tokens: records.map((r) => r.token),
      data: this.normalizeData(payload),
      ...(displayNotification ? { notification: displayNotification } : {}),
      android: {
        ttl: options.ttlSeconds * 1000,
        collapseKey: options.collapseKey,
      },
      apns: {
        headers: {
          'apns-expiration': `${Math.floor(Date.now() / 1000) + options.ttlSeconds}`,
          ...(options.collapseKey
            ? { 'apns-collapse-id': options.collapseKey }
            : {}),
        },
      },
      webpush: {
        headers: {
          TTL: String(options.ttlSeconds),
          ...(options.collapseKey ? { Topic: options.collapseKey } : {}),
        },
      },
    };

    const response = await this.sendWithRetry(message);
    await this.handleProviderResponse(records, response);

    this.logger.log(
      `Push delivery type=${payload.type ?? 'UNKNOWN'} success=${response.successCount} failure=${response.failureCount}${pushCorrelationSuffix(payload)}`,
    );

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  }

  async handleProviderResponse(
    records: Array<{ token: string; userId: string }>,
    response: admin.messaging.BatchResponse,
  ) {
    for (let i = 0; i < response.responses.length; i++) {
      const result = response.responses[i];
      const tokenRecord = records[i];
      if (!tokenRecord || result.success) continue;

      const code = result.error?.code ?? 'unknown';
      const isInvalidToken =
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/registration-token-not-registered';

      if (isInvalidToken) {
        await this.prisma.pushToken.updateMany({
          where: { token: tokenRecord.token, isActive: true },
          data: {
            isActive: false,
            lastErrorCode: code,
            lastErrorAt: new Date(),
          },
        });
        this.logger.warn(
          `Push token deactivated user=${tokenRecord.userId} code=${code}`,
        );
        continue;
      }

      await this.prisma.pushToken.updateMany({
        where: { token: tokenRecord.token },
        data: {
          lastErrorCode: code,
          lastErrorAt: new Date(),
        },
      });
    }
  }

  private async sendWithRetry(
    message: admin.messaging.MulticastMessage,
  ): Promise<admin.messaging.BatchResponse> {
    const messaging = admin.messaging(this.app!);
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await messaging.sendEachForMulticast(message);
      } catch (error) {
        const err = error as { code?: string; message?: string };
        const transient = this.isTransientError(err.code);
        if (!transient || attempt === maxAttempts) {
          this.logger.error(
            `Push send failed attempts=${attempt} code=${err.code ?? 'unknown'} message=${err.message ?? 'unknown'}`,
          );
          throw error;
        }

        const delayMs = 200 * 2 ** attempt;
        this.logger.warn(
          `Transient push error, retry in ${delayMs}ms (attempt=${attempt})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return {
      successCount: 0,
      failureCount: 0,
      responses: [],
    };
  }

  private normalizeData(payload: PushPayload): Record<string, string> {
    const base = {
      notificationId: payload.notificationId ?? uuidv7(),
      ...payload,
    };

    return Object.entries(base).reduce<Record<string, string>>(
      (acc, [k, v]) => {
        if (v === undefined || v === null) return acc;
        acc[k] = String(v);
        return acc;
      },
      {},
    );
  }

  private isDuplicate(dedupeKey: string): boolean {
    const now = Date.now();
    const ttlMs = 60_000;

    for (const [key, expiresAt] of this.dedupeCache.entries()) {
      if (expiresAt <= now) this.dedupeCache.delete(key);
    }

    const exists = this.dedupeCache.get(dedupeKey);
    if (exists && exists > now) {
      return true;
    }

    this.dedupeCache.set(dedupeKey, now + ttlMs);
    return false;
  }

  private isTransientError(code?: string): boolean {
    return (
      code === 'messaging/internal-error' ||
      code === 'messaging/server-unavailable' ||
      code === 'messaging/unknown-error'
    );
  }

  private initFirebaseApp(): admin.app.App | null {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKeyRaw = this.configService.get<string>(
      'FIREBASE_PRIVATE_KEY',
    );
    const serviceAccountJson = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_JSON',
    );

    try {
      if (serviceAccountJson) {
        const parsed = JSON.parse(serviceAccountJson) as admin.ServiceAccount;
        return admin.initializeApp({
          credential: admin.credential.cert(parsed),
        });
      }

      if (projectId && clientEmail && privateKeyRaw) {
        return admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKeyRaw.replace(/\\n/g, '\n'),
          }),
        });
      }

      this.logger.warn(
        'Firebase credentials are not configured, push delivery disabled',
      );
      return null;
    } catch (error) {
      const err = error as { message?: string };
      this.logger.error(
        `Firebase initialization failed: ${err.message ?? 'unknown'}`,
      );
      return null;
    }
  }
}
