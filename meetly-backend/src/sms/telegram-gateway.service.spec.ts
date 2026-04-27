import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TelegramGatewayService } from './telegram-gateway.service';

describe('TelegramGatewayService', () => {
  let service: TelegramGatewayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramGatewayService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(TelegramGatewayService);
  });

  it('returns ok:false when token is missing', async () => {
    const result = await service.trySendVerificationCode('+77001234567', '1234', 600);
    expect(result).toEqual({ ok: false });
  });
});
