import { EventStatus } from '@prisma/client';

/** Default window before effective end when organizer may start marking attendance */
export const DEFAULT_ORGANIZER_CHECK_IN_EARLY_MINUTES = 10;

const CHECK_IN_WINDOW_AFTER_END_MS = 2 * 60 * 60 * 1000;

const ISO_DATETIME_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2}|[+-]\d{4})$/;

export const EVENT_INSTANT_REQUIRES_TZ_MESSAGE =
  'startTime and endTime must be ISO 8601 datetimes with an explicit timezone (Z or ±hh:mm)';

export interface EventTimeFields {
  date: Date;
  startTime: Date | null;
  endTime: Date | null;
}

export function parseEventInstantOrThrow(iso: string): Date {
  const trimmed = iso.trim();
  if (!ISO_DATETIME_WITH_OFFSET.test(trimmed)) {
    throw new Error(EVENT_INSTANT_REQUIRES_TZ_MESSAGE);
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid datetime');
  }
  return d;
}

export function parseOptionalEventInstant(
  iso: string | undefined | null,
): Date | undefined {
  if (iso == null || iso === '') return undefined;
  return parseEventInstantOrThrow(iso);
}

export function getEffectiveStartAt(event: EventTimeFields): Date {
  return event.startTime ?? event.date;
}

export function getEffectiveEndAt(event: EventTimeFields): Date {
  return event.endTime ?? event.date;
}

export interface OrganizerMarkAttendanceUiInput extends EventTimeFields {
  viewerId: string;
  creatorId: string;
  status: EventStatus;
  now: Date;
  earlyMinutes?: number;
}

export interface OrganizerMarkAttendanceUi {
  showMarkAttendanceButton: boolean;
  markAttendanceOpensAt: string | null;
  markAttendanceDeadlineAt: string | null;
}

/** Start of the UTC calendar day for `d` (00:00:00.000 UTC). */
export function startOfDayUtc(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

export function getOrganizerMarkAttendanceUi(
  input: OrganizerMarkAttendanceUiInput,
): OrganizerMarkAttendanceUi {
  const early =
    input.earlyMinutes ?? DEFAULT_ORGANIZER_CHECK_IN_EARLY_MINUTES;

  const end = getEffectiveEndAt(input);
  const start = getEffectiveStartAt(input);
  const opensAt = new Date(end.getTime() - early * 60 * 1000);
  const deadline = new Date(end.getTime() + CHECK_IN_WINDOW_AFTER_END_MS);

  const markAttendanceOpensAt = opensAt.toISOString();
  const markAttendanceDeadlineAt = deadline.toISOString();

  if (input.viewerId !== input.creatorId) {
    return {
      showMarkAttendanceButton: false,
      markAttendanceOpensAt: null,
      markAttendanceDeadlineAt: null,
    };
  }

  if (input.status === EventStatus.FINALIZED) {
    return {
      showMarkAttendanceButton: false,
      markAttendanceOpensAt,
      markAttendanceDeadlineAt,
    };
  }

  const show =
    input.now >= opensAt && input.now <= deadline && input.now >= start;

  return {
    showMarkAttendanceButton: show,
    markAttendanceOpensAt,
    markAttendanceDeadlineAt,
  };
}
