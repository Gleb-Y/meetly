export enum PushType {
  CHAT_MESSAGE = 'CHAT_MESSAGE',
  FRIEND_REQUEST = 'FRIEND_REQUEST',
  FRIEND_EVENT_CREATED = 'FRIEND_EVENT_CREATED',
  PROFILE_EVENTS_UPDATED = 'PROFILE_EVENTS_UPDATED',
  EVENT_EXPIRED = 'EVENT_EXPIRED',
  ATTENDANCE_REWARD = 'ATTENDANCE_REWARD',
  NO_SHOW_PENALTY = 'NO_SHOW_PENALTY',
  EVENT_FINALIZED = 'EVENT_FINALIZED',
  ORGANIZER_HOST_KARMA = 'ORGANIZER_HOST_KARMA',
  /** Organizer did not mark anyone present — reminder only, no karma change from this. */
  ORGANIZER_ATTENDANCE_REMINDER = 'ORGANIZER_ATTENDANCE_REMINDER',
}

export type PushPayload = Record<string, string | undefined>;

export interface PushSendOptions {
  ttlSeconds: number;
  collapseKey?: string;
  dedupeKey?: string;
}

export const PUSH_POLICY: Record<PushType, PushSendOptions> = {
  [PushType.CHAT_MESSAGE]: {
    ttlSeconds: 60 * 60 * 2,
  },
  [PushType.FRIEND_REQUEST]: {
    ttlSeconds: 60 * 60 * 24,
  },
  [PushType.FRIEND_EVENT_CREATED]: {
    ttlSeconds: 60 * 60 * 12,
  },
  [PushType.PROFILE_EVENTS_UPDATED]: {
    ttlSeconds: 60 * 15,
    collapseKey: 'profile_events_updated',
  },
  [PushType.EVENT_EXPIRED]: {
    ttlSeconds: 60 * 60 * 6,
    collapseKey: 'event_expired',
  },
  [PushType.ATTENDANCE_REWARD]: {
    ttlSeconds: 60 * 60 * 24,
    collapseKey: 'attendance_reward',
  },
  [PushType.NO_SHOW_PENALTY]: {
    ttlSeconds: 60 * 60 * 24,
    collapseKey: 'no_show_penalty',
  },
  [PushType.EVENT_FINALIZED]: {
    ttlSeconds: 60 * 60 * 24,
    collapseKey: 'event_finalized',
  },
  [PushType.ORGANIZER_HOST_KARMA]: {
    ttlSeconds: 60 * 60 * 24,
    collapseKey: 'organizer_host_karma',
  },
  [PushType.ORGANIZER_ATTENDANCE_REMINDER]: {
    ttlSeconds: 60 * 60 * 24,
    collapseKey: 'organizer_attendance_reminder',
  },
};
