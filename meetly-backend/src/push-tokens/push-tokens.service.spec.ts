/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { PushTokensService } from './push-tokens.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushPlatform } from '@prisma/client';

describe('PushTokensService', () => {
  let service: PushTokensService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      pushToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushTokensService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PushTokensService>(PushTokensService);
  });

  it('creates new token when absent', async () => {
    prisma.pushToken.findUnique.mockResolvedValue(null);
    await service.registerToken('user-1', 'token-1', PushPlatform.android);
    expect(prisma.pushToken.create).toHaveBeenCalled();
  });

  it('deactivates token on delete endpoint action', async () => {
    prisma.pushToken.updateMany.mockResolvedValue({ count: 1 });
    await service.deactivateToken('user-1', 'token-1');
    expect(prisma.pushToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', token: 'token-1', isActive: true },
      }),
    );
  });
});
