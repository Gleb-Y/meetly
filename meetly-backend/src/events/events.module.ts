import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { EventSchedulerService } from './event-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatModule } from '../chat/chat.module';
import { UploadModule } from '../upload/upload.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    PrismaModule,
    ChatModule,
    UploadModule,
    NotificationsModule,
    AdminModule,
  ],
  controllers: [EventsController],
  providers: [EventsService, EventSchedulerService],
  exports: [EventsService],
})
export class EventsModule {}
