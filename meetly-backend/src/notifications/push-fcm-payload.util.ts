import * as admin from 'firebase-admin';
import { PushPayload } from './push.types';

const TITLE_MAX = 200;
const BODY_MAX = 1500;

/** Truncate for FCM/APNs display limits. */
export function truncateForDisplay(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/**
 * Maps our data payload to FCM `notification` so iOS/Android can show a system banner
 * when the app is backgrounded (data-only messages often do not).
 */
export function buildFcmDisplayNotification(
  payload: PushPayload,
): admin.messaging.Notification | undefined {
  const titleRaw = payload.title?.trim();
  const bodyRaw = payload.body?.trim();
  if (!titleRaw && !bodyRaw) {
    return undefined;
  }
  const title = titleRaw
    ? truncateForDisplay(titleRaw, TITLE_MAX)
    : 'Meetly';
  const body = bodyRaw
    ? truncateForDisplay(bodyRaw, BODY_MAX)
    : '';
  return { title, body: body || ' ' };
}

/** Extra fields for correlating server logs with client messageId / chatId. */
export function pushCorrelationSuffix(payload: PushPayload): string {
  const parts: string[] = [];
  if (payload.messageId) parts.push(`messageId=${payload.messageId}`);
  if (payload.chatId) parts.push(`chatId=${payload.chatId}`);
  if (payload.notificationId) {
    parts.push(`notificationId=${payload.notificationId}`);
  }
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}
