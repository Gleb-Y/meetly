import { Injectable, Logger } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { NotificationsGateway } from './notifications.gateway';
import { PushNotificationService } from './push-notification.service';
import { PUSH_POLICY, PushPayload, PushSendOptions, PushType } from './push.types';

@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    private readonly notificationsGateway: NotificationsGateway,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  /**
   * Triggers client refetch of profile (karma, counters). Uses a unique dedupe key
   * so several karma updates in a row are not collapsed like generic profile_events.
   */
  notifyProfileKarmaRefetch(userId: string): void {
    const notificationId = uuidv7();
    const payload = {
      type: PushType.PROFILE_EVENTS_UPDATED,
      notificationId,
      timestamp: new Date().toISOString(),
    };
    void this.notifyUser(userId, payload, payload, {
      ...PUSH_POLICY[PushType.PROFILE_EVENTS_UPDATED],
      dedupeKey: `profile_karma:${notificationId}`,
    }).catch((error: Error) => {
      this.logger.error(
        `PROFILE karma refetch failed user=${userId}: ${error.message}`,
      );
    });
  }

  async notifyUser(
    userId: string,
    socketPayload: Record<string, unknown>,
    pushPayload: PushPayload,
    options: PushSendOptions,
  ) {
    this.notificationsGateway.sendToUser(userId, 'notification', socketPayload);
    await this.pushNotificationService.sendToUser(userId, pushPayload, options);
  }

  async notifyUsers(
    userIds: string[],
    socketPayload: Record<string, unknown>,
    pushPayload: PushPayload,
    options: PushSendOptions,
  ) {
    for (const userId of userIds) {
      this.notificationsGateway.sendToUser(
        userId,
        'notification',
        socketPayload,
      );
    }
    await this.pushNotificationService.sendToUsers(
      userIds,
      pushPayload,
      options,
    );
  }
}
