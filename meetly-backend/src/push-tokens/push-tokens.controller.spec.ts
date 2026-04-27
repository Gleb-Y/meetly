/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { PushTokensController } from './push-tokens.controller';
import { PushTokensService } from './push-tokens.service';
import { PushPlatform } from '@prisma/client';

describe('PushTokensController', () => {
  let controller: PushTokensController;
  const service = {
    registerToken: jest.fn(),
    deactivateToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PushTokensController],
      providers: [{ provide: PushTokensService, useValue: service }],
    }).compile();

    controller = module.get<PushTokensController>(PushTokensController);
  });

  it('register delegates to service', async () => {
    await controller.register({ id: 'u1' } as any, {
      token: 'token-1',
      platform: PushPlatform.ios,
    });
    expect(service.registerToken).toHaveBeenCalledWith(
      'u1',
      'token-1',
      PushPlatform.ios,
    );
  });

  it('delete delegates to service', async () => {
    await controller.delete({ id: 'u1' } as any, { token: 'token-1' });
    expect(service.deactivateToken).toHaveBeenCalledWith('u1', 'token-1');
  });
});
