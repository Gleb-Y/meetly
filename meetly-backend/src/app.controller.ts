import { Controller, Get } from '@nestjs/common';
import { PushNotificationService } from './notifications/push-notification.service';

@Controller()
export class AppController {
  constructor(
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'meetly-backend',
      push: {
        fcmConfigured: this.pushNotificationService.isDeliveryConfigured(),
      },
    };
  }

  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      push: {
        fcmConfigured: this.pushNotificationService.isDeliveryConfigured(),
      },
    };
  }
}
