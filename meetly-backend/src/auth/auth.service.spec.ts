import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { TelegramGatewayService } from '../sms/telegram-gateway.service';
import { VerificationDeliveryChannel } from '@prisma/client';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;
  let getMyProfileMock: jest.Mock;
  let configGet: jest.Mock;

  const prismaMock = {
    verificationCode: {
      count: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const smsMock = {
    sendVerificationCode: jest.fn(),
    verifyCode: jest.fn(),
  };
  const tgMock = {
    trySendVerificationCode: jest.fn(),
    reportVerificationCompleted: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    getMyProfileMock = jest.fn().mockResolvedValue({ id: 'user-1', from: 'getMyProfile' });
    configGet = jest.fn((key: string) => {
      if (key === 'GOOGLE_CLIENT_ID') return 'test-google-client-id';
      return undefined;
    });
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('jwt-token') },
        },
        { provide: SmsService, useValue: smsMock },
        { provide: TelegramGatewayService, useValue: tgMock },
        {
          provide: ConfigService,
          useValue: { get: configGet },
        },
        { provide: UsersService, useValue: { getMyProfile: getMyProfileMock } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendVerificationCode', () => {
    const dto = { phoneNumber: '+77001234567' };

    beforeEach(() => {
      prismaMock.verificationCode.count.mockResolvedValue(0);
      prismaMock.verificationCode.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.verificationCode.create.mockResolvedValue({ id: 'vc-1' });
      prismaMock.verificationCode.update.mockResolvedValue({});
    });

    it('uses Telegram when gateway succeeds', async () => {
      tgMock.trySendVerificationCode.mockResolvedValue({
        ok: true,
        requestId: 'tg-req-1',
      });

      const result = await service.sendVerificationCode(dto);

      expect(tgMock.trySendVerificationCode).toHaveBeenCalledWith(
        dto.phoneNumber,
        expect.any(String),
        600,
      );
      expect(smsMock.sendVerificationCode).not.toHaveBeenCalled();
      expect(prismaMock.verificationCode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          identifier: dto.phoneNumber,
          code: expect.stringMatching(/^\d{4}$/),
          deliveryChannel: VerificationDeliveryChannel.TELEGRAM_GATEWAY,
          telegramRequestId: 'tg-req-1',
        }),
      });
      expect(result).toMatchObject({
        channel: 'telegram',
        expiresIn: 600,
      });
    });

    it('falls back to SMS when Telegram fails', async () => {
      tgMock.trySendVerificationCode.mockResolvedValue({ ok: false });
      smsMock.sendVerificationCode.mockResolvedValue(undefined);

      const result = await service.sendVerificationCode(dto);

      expect(smsMock.sendVerificationCode).toHaveBeenCalledWith(dto.phoneNumber);
      expect(prismaMock.verificationCode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          identifier: dto.phoneNumber,
          code: 'SMS',
          deliveryChannel: VerificationDeliveryChannel.SMS,
          telegramRequestId: null,
        }),
      });
      expect(result).toMatchObject({ channel: 'sms', expiresIn: 300 });
    });

    it('skips Telegram when VERIFICATION_SMS_ONLY is true', async () => {
      configGet.mockImplementation((key: string) => {
        if (key === 'GOOGLE_CLIENT_ID') return 'test-google-client-id';
        if (key === 'VERIFICATION_SMS_ONLY') return 'true';
        return undefined;
      });
      tgMock.trySendVerificationCode.mockResolvedValue({
        ok: true,
        requestId: 'would-not-run',
      });
      smsMock.sendVerificationCode.mockResolvedValue(undefined);

      const result = await service.sendVerificationCode(dto);

      expect(tgMock.trySendVerificationCode).not.toHaveBeenCalled();
      expect(smsMock.sendVerificationCode).toHaveBeenCalledWith(dto.phoneNumber);
      expect(result).toMatchObject({ channel: 'sms', expiresIn: 300 });
    });
  });

  describe('verifyCode', () => {
    it('delegates to SmsService when delivery was SMS', async () => {
      const phoneNumber = '+77001234567';
      const code = '1234';
      smsMock.verifyCode.mockReturnValue(true);
      prismaMock.verificationCode.findFirst.mockResolvedValue({
        id: 'vc-sms',
        identifier: phoneNumber,
        code: 'SMS',
        verified: false,
        expiresAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
        userId: null,
        deliveryChannel: VerificationDeliveryChannel.SMS,
        telegramRequestId: null,
      });
      prismaMock.user.findUnique
        .mockResolvedValueOnce({
          id: 'user-1',
          phoneNumber,
        })
        .mockResolvedValueOnce({
          id: 'user-1',
          phoneNumber,
          interests: [],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          username: null,
          avatar: null,
          bio: null,
          age: null,
        });
      prismaMock.verificationCode.update.mockResolvedValue({});

      await service.verifyCode({ phoneNumber, code });

      expect(smsMock.verifyCode).toHaveBeenCalledWith(phoneNumber, code);
      expect(tgMock.reportVerificationCompleted).not.toHaveBeenCalled();
    });

    it('calls reportVerificationCompleted when telegramRequestId present', async () => {
      const phoneNumber = '+77001234567';
      const code = '1234';
      prismaMock.verificationCode.findFirst.mockResolvedValue({
        id: 'vc-1',
        identifier: phoneNumber,
        code,
        verified: false,
        expiresAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
        userId: null,
        deliveryChannel: VerificationDeliveryChannel.TELEGRAM_GATEWAY,
        telegramRequestId: 'tg-req-x',
      });
      prismaMock.user.findUnique
        .mockResolvedValueOnce({
          id: 'user-1',
          phoneNumber,
        })
        .mockResolvedValueOnce({
          id: 'user-1',
          phoneNumber,
          interests: [],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          username: null,
          avatar: null,
          bio: null,
          age: null,
        });
      prismaMock.verificationCode.update.mockResolvedValue({});

      await service.verifyCode({ phoneNumber, code });

      expect(tgMock.reportVerificationCompleted).toHaveBeenCalledWith(
        'tg-req-x',
        code,
      );
    });
  });

  describe('updateProfile', () => {
    it('persists dto then returns getMyProfile snapshot', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.update.mockResolvedValue({});

      const result = await service.updateProfile('user-1', {
        isProfileClosed: true,
        showFriendsInProfile: false,
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isProfileClosed: true, showFriendsInProfile: false },
      });
      expect(getMyProfileMock).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ id: 'user-1', from: 'getMyProfile' });
    });
  });
});
