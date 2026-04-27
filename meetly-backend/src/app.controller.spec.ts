import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { PushNotificationService } from './notifications/push-notification.service';

describe('AppController', () => {
  let appController: AppController;
  let pushNotificationService: { isDeliveryConfigured: jest.Mock };

  beforeEach(async () => {
    pushNotificationService = {
      isDeliveryConfigured: jest.fn().mockReturnValue(true),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: PushNotificationService,
          useValue: pushNotificationService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getHealth', () => {
    it('should include push.fcmConfigured', () => {
      const result = appController.getHealth();
      expect(result.push).toEqual({ fcmConfigured: true });
    });
  });

  describe('healthCheck', () => {
    it('should include push.fcmConfigured', () => {
      const result = appController.healthCheck();
      expect(result.push).toEqual({ fcmConfigured: true });
    });
  });
});
