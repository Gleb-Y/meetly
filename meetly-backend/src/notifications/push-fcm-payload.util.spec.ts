import {
  buildFcmDisplayNotification,
  pushCorrelationSuffix,
  truncateForDisplay,
} from './push-fcm-payload.util';
import { PushType } from './push.types';

describe('push-fcm-payload.util', () => {
  it('returns undefined when no title or body', () => {
    expect(
      buildFcmDisplayNotification({ type: PushType.EVENT_EXPIRED }),
    ).toBeUndefined();
  });

  it('builds notification from title and body', () => {
    expect(
      buildFcmDisplayNotification({
        type: PushType.CHAT_MESSAGE,
        title: 'New message',
        body: 'Hello',
      }),
    ).toEqual({ title: 'New message', body: 'Hello' });
  });

  it('uses default title when only body is set', () => {
    expect(
      buildFcmDisplayNotification({
        type: PushType.CHAT_MESSAGE,
        body: 'Ping',
      }),
    ).toEqual({ title: 'Meetly', body: 'Ping' });
  });

  it('truncates long body', () => {
    const long = 'x'.repeat(2000);
    const n = buildFcmDisplayNotification({
      type: PushType.CHAT_MESSAGE,
      title: 'T',
      body: long,
    });
    expect(n).toBeDefined();
    expect(n!.body!.length).toBeLessThanOrEqual(1500);
    expect(n!.body!.endsWith('…')).toBe(true);
  });

  it('truncateForDisplay leaves short strings unchanged', () => {
    expect(truncateForDisplay('hi', 10)).toBe('hi');
  });

  it('pushCorrelationSuffix includes known ids', () => {
    expect(
      pushCorrelationSuffix({
        type: PushType.CHAT_MESSAGE,
        messageId: 'm1',
        chatId: 'c1',
        notificationId: 'n1',
      }),
    ).toBe(' messageId=m1 chatId=c1 notificationId=n1');
  });

  it('pushCorrelationSuffix is empty when no ids', () => {
    expect(pushCorrelationSuffix({ type: PushType.FRIEND_REQUEST })).toBe('');
  });
});
