/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { PushNotificationService } from './push-notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('PushNotificationService', () => {
  let service: PushNotificationService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      pushToken: {
        updateMany: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushNotificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<PushNotificationService>(PushNotificationService);
  });

  it('deactivates invalid tokens from provider response', async () => {
    await service.handleProviderResponse(
      [{ token: 'bad-token', userId: 'u1' }],
      {
        successCount: 0,
        failureCount: 1,
        responses: [
          {
            success: false,
            error: {
              code: 'messaging/registration-token-not-registered',
            } as any,
          },
        ],
      } as any,
    );

    expect(prisma.pushToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: 'bad-token', isActive: true },
      }),
    );
  });
});
