import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GATEWAY_BASE = 'https://gatewayapi.telegram.org';

type GatewayResponse<T> =
  | { ok: true; result: T }
  | { ok: false; error: string };

export type TelegramSendResult =
  | { ok: true; requestId: string }
  | { ok: false };

@Injectable()
export class TelegramGatewayService {
  private readonly logger = new Logger(TelegramGatewayService.name);

  constructor(private readonly configService: ConfigService) {}

  private getToken(): string | undefined {
    return this.configService.get<string>('TELEGRAM_GATEWAY_ACCESS_TOKEN');
  }

  /**
   * checkSendAbility + sendVerificationMessage with a server-generated code.
   * Returns request_id on success for analytics (checkVerificationStatus).
   */
  async trySendVerificationCode(
    phoneNumber: string,
    code: string,
    ttlSeconds: number,
  ): Promise<TelegramSendResult> {
    const token = this.getToken();
    if (!token?.trim()) {
      return { ok: false };
    }

    try {
      const check = await this.post<GatewayResponse<{ request_id: string }>>(
        'checkSendAbility',
        { phone_number: phoneNumber },
        token,
      );
      if (!check.ok || !check.result?.request_id) {
        this.logger.debug(
          `Telegram Gateway checkSendAbility unavailable for ${phoneNumber}: ${!check.ok ? check.error : 'no request_id'}`,
        );
        return { ok: false };
      }

      const send = await this.post<GatewayResponse<{ request_id: string }>>(
        'sendVerificationMessage',
        {
          phone_number: phoneNumber,
          request_id: check.result.request_id,
          code,
          ttl: ttlSeconds,
        },
        token,
      );

      if (!send.ok || !send.result?.request_id) {
        this.logger.warn(
          `Telegram Gateway sendVerificationMessage failed for ${phoneNumber}: ${!send.ok ? send.error : 'no request_id'}`,
        );
        return { ok: false };
      }

      return { ok: true, requestId: send.result.request_id };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Telegram Gateway error for ${phoneNumber}: ${msg}`);
      return { ok: false };
    }
  }

  /**
   * Report successful code entry to Telegram (conversion metrics). Best-effort.
   */
  async reportVerificationCompleted(
    requestId: string,
    code: string,
  ): Promise<void> {
    const token = this.getToken();
    if (!token?.trim()) return;

    try {
      const res = await this.post<GatewayResponse<unknown>>(
        'checkVerificationStatus',
        { request_id: requestId, code },
        token,
      );
      if (!res.ok) {
        this.logger.debug(
          `checkVerificationStatus for ${requestId}: ${res.error}`,
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.debug(`checkVerificationStatus failed: ${msg}`);
    }
  }

  private async post<T>(
    method: string,
    body: Record<string, string | number>,
    token: string,
  ): Promise<T> {
    const url = `${GATEWAY_BASE}/${method}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as T;
    return data;
  }
}
