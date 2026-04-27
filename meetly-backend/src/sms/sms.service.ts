import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// CJS package: default import compiles to `.default()` and crashes at runtime without esModuleInterop.
import twilio = require('twilio');

type CachedCode = { code: string; expiresAt: number };
type TwilioClient = ReturnType<typeof twilio>;

function isTruthyEnvFlag(raw: string | undefined): boolean {
  if (raw === undefined || raw === null) return false;
  const v = String(raw).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly isDev: boolean;
  private readonly twilioClient?: TwilioClient;
  private readonly fromNumber?: string;
  private readonly cache = new Map<string, CachedCode>();
  private static readonly SMS_CODE_TTL_MS = 5 * 60 * 1000;

  constructor(private readonly configService: ConfigService) {
    const smsLogOnly = isTruthyEnvFlag(
      this.configService.get<string>('SMS_LOG_ONLY'),
    );
    const notProduction =
      this.configService.get<string>('NODE_ENV') !== 'production';
    this.isDev = smsLogOnly || notProduction;

    this.warnIfTwilioEnvTypo();

    if (this.isDev) {
      const reason = smsLogOnly
        ? 'SMS_LOG_ONLY is truthy (1/true/yes)'
        : 'NODE_ENV is not exactly "production"';
      this.logger.warn(
        `Twilio SMS is disabled (${reason}). OTP goes to server logs only (see [DEV] SMS code).`,
      );
    } else {
      const accountSid = this.configService.getOrThrow<string>(
        'TWILIO_ACCOUNT_SID',
      );
      const authToken = this.configService.getOrThrow<string>(
        'TWILIO_AUTH_TOKEN',
      );
      this.fromNumber = this.configService.getOrThrow<string>(
        'TWILIO_PHONE_NUMBER',
      );
      this.twilioClient = twilio(accountSid, authToken);
      this.logger.log('Twilio SMS client initialized.');
    }
  }

  /** Railway typo: TWILI0_* (zero) instead of TWILIO_* (letter O). */
  private warnIfTwilioEnvTypo(): void {
    const hasZeroTypo = Boolean(
      process.env.TWILI0_ACCOUNT_SID?.trim() ||
        process.env.TWILI0_AUTH_TOKEN?.trim() ||
        process.env.TWILI0_PHONE_NUMBER?.trim(),
    );
    if (hasZeroTypo) {
      this.logger.error(
        'Found TWILI0_* env vars (digit 0). Rename to TWILIO_* (letter O) — the app only reads TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.',
      );
    }
  }

  private normalizePhone(phoneNumber: string): string {
    return phoneNumber.trim();
  }

  private getValidEntry(phoneKey: string): CachedCode | undefined {
    const entry = this.cache.get(phoneKey);
    if (!entry) {
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(phoneKey);
      return undefined;
    }
    return entry;
  }

  async sendVerificationCode(phoneNumber: string): Promise<void> {
    const key = this.normalizePhone(phoneNumber);
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = Date.now() + SmsService.SMS_CODE_TTL_MS;
    this.cache.set(key, { code, expiresAt });

    if (this.isDev) {
      this.logger.warn(`[DEV] SMS code for ${phoneNumber}: ${code}`);
      console.log(
        `\n${'─'.repeat(40)}\n📱 Phone: ${phoneNumber}\n🔐 Code:  ${code}\n${'─'.repeat(40)}\n`,
      );
      return;
    }

    const body = `Meetly: твой код подтверждения — ${code}.`;

    try {
      await this.twilioClient!.messages.create({
        to: phoneNumber,
        from: this.fromNumber!,
        body,
      });
      this.logger.log(`SMS sent to ${phoneNumber}`);
    } catch (error: unknown) {
      this.cache.delete(key);
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send SMS to ${phoneNumber}: ${message}`);
      throw new BadRequestException('Failed to send verification code');
    }
  }

  verifyCode(phoneNumber: string, code: string): boolean {
    const key = this.normalizePhone(phoneNumber);
    const entry = this.getValidEntry(key);

    if (!entry || entry.code !== code) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    this.cache.delete(key);
    return true;
  }
}
