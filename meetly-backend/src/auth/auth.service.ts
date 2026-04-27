import {
  Injectable,
  BadRequestException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { VerificationDeliveryChannel } from '@prisma/client';
import { SendCodeDto } from './dto/sms.dto';
import { VerifyCodeDto } from './dto/verify-sms.dto';
import { SmsService } from 'src/sms/sms.service';
import { TelegramGatewayService } from 'src/sms/telegram-gateway.service';
import {
  USER_PRIVATE_SELECT,
  VALID_INTERESTS,
} from './constants/auth.constants';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { UsersService } from '../users/users.service';

const CODE_TTL_TELEGRAM_SECONDS = 600;
const CODE_TTL_SMS_SECONDS = 300;
/** Prisma `code` for SMS deliveries; real OTP lives in SmsService cache */
const SMS_CODE_PLACEHOLDER = 'SMS';

function isTruthyEnvFlag(raw: string | undefined): boolean {
  if (raw === undefined || raw === null) return false;
  const v = String(raw).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private smsService: SmsService,
    private telegramGateway: TelegramGatewayService,
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.get('GOOGLE_CLIENT_ID'),
    );
  }

  /**
   * 📱 Отправить код на телефон
   */
  async sendVerificationCode(sendCodeDto: SendCodeDto) {
    const { phoneNumber } = sendCodeDto;

    // Rate limiting: не более 5 кодов в 15 минут
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentCodes = await this.prisma.verificationCode.count({
      where: {
        identifier: phoneNumber,
        createdAt: { gte: fifteenMinutesAgo },
      },
    });

    if (recentCodes >= 5) {
      throw new BadRequestException(
        'Too many requests. Please try again in 15 minutes.',
      );
    }

    // Удаляем старые неиспользованные коды
    await this.prisma.verificationCode.deleteMany({
      where: {
        identifier: phoneNumber,
        verified: false,
      },
    });

    const smsOnly = isTruthyEnvFlag(
      this.configService.get<string>('VERIFICATION_SMS_ONLY'),
    );

    const telegramCode = Math.floor(1000 + Math.random() * 9000).toString();
    const tgResult = smsOnly
      ? ({ ok: false } as const)
      : await this.telegramGateway.trySendVerificationCode(
          phoneNumber,
          telegramCode,
          CODE_TTL_TELEGRAM_SECONDS,
        );

    if (smsOnly) {
      this.logger.log(
        'send-code: VERIFICATION_SMS_ONLY is set; skipping Telegram Gateway',
      );
    }

    let channel: 'telegram' | 'sms';
    let expiresIn: number;

    if (tgResult.ok) {
      channel = 'telegram';
      expiresIn = CODE_TTL_TELEGRAM_SECONDS;
      const expiresAt = new Date(
        Date.now() + CODE_TTL_TELEGRAM_SECONDS * 1000,
      );
      await this.prisma.verificationCode.create({
        data: {
          identifier: phoneNumber,
          code: telegramCode,
          expiresAt,
          deliveryChannel: VerificationDeliveryChannel.TELEGRAM_GATEWAY,
          telegramRequestId: tgResult.requestId,
        },
      });
    } else {
      channel = 'sms';
      expiresIn = CODE_TTL_SMS_SECONDS;
      try {
        await this.smsService.sendVerificationCode(phoneNumber);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to send SMS: ${msg}`);
        throw new BadRequestException('Failed to send verification code');
      }
      const expiresAt = new Date(Date.now() + CODE_TTL_SMS_SECONDS * 1000);
      await this.prisma.verificationCode.create({
        data: {
          identifier: phoneNumber,
          code: SMS_CODE_PLACEHOLDER,
          expiresAt,
          deliveryChannel: VerificationDeliveryChannel.SMS,
          telegramRequestId: null,
        },
      });
    }

    this.logger.log(
      `send-code: channel=${channel} expiresIn=${expiresIn}s (Twilio SMS when channel=sms needs NODE_ENV=production and SMS_LOG_ONLY unset/false)`,
    );

    return {
      message: 'Verification code sent',
      expiresIn,
      channel,
    };
  }

  /**
   * ✅ Подтвердить код
   */
  async verifyCode(verifyCodeDto: VerifyCodeDto) {
    const { phoneNumber, code } = verifyCodeDto;

    const verification = await this.prisma.verificationCode.findFirst({
      where: {
        identifier: phoneNumber,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    if (verification.deliveryChannel === VerificationDeliveryChannel.SMS) {
      this.smsService.verifyCode(phoneNumber, code);
    } else if (verification.code !== code) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    const telegramRequestId = verification.telegramRequestId;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.verificationCode.update({
        where: { id: verification.id },
        data: { verified: true },
      });

      let user = await tx.user.findUnique({ where: { phoneNumber } });
      const isNewUser = !user;

      if (!user) {
        user = await tx.user.create({ data: { phoneNumber, isActive: true } });
      }

      await tx.verificationCode.update({
        where: { id: verification.id },
        data: { userId: user.id },
      });

      const accessToken = this.generateToken(user);

      const userData = await tx.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          phoneNumber: true,
          interests: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          username: true,
          avatar: true,
          bio: true,
          age: true,
        },
      });

      return { user: userData, accessToken, isNewUser };
    });

    if (telegramRequestId) {
      await this.telegramGateway.reportVerificationCompleted(
        telegramRequestId,
        code,
      );
    }

    return result;
  }

  async completeProfile(userId: string, dto: CompleteProfileDto) {
    await this.checkUsernameUnique(userId, dto.username);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { ...dto },
      select: USER_PRIVATE_SELECT,
    });

    return { user: updatedUser, profileCompleted: true };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.username) await this.checkUsernameUnique(userId, dto.username);

    if (dto.interests) {
      const allowed = new Set<string>(VALID_INTERESTS);
      const invalid = dto.interests.filter((i) => !allowed.has(i));
      if (invalid.length > 0)
        throw new BadRequestException(
          `Invalid interests: ${invalid.join(', ')}`,
        );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });

    return this.usersService.getMyProfile(userId);
  }

  private async checkUsernameUnique(userId: string, username: string) {
    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing && existing.id !== userId) {
      throw new ConflictException('Username already taken');
    }
  }

  private generateToken(user: {
    id: string;
    phoneNumber: string | null;
  }): string {
    return this.jwtService.sign({
      sub: user.id,
      phoneNumber: user.phoneNumber,
    });
  }
}
