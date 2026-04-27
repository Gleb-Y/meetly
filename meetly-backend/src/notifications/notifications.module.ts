import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationsGateway } from './notifications.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { PushNotificationService } from './push-notification.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '30d' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    NotificationsGateway,
    PushNotificationService,
    NotificationDispatcherService,
  ],
  exports: [
    NotificationsGateway,
    PushNotificationService,
    NotificationDispatcherService,
  ],
})
export class NotificationsModule {}
