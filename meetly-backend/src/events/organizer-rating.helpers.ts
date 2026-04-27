import { AttendanceStatus, EventStatus } from '@prisma/client';

export function organizerRatingViewerState(input: {
  viewerId: string;
  organizerId: string;
  eventStatus: EventStatus;
  attendanceStatus: AttendanceStatus | null | undefined;
  hasExistingRating: boolean;
}): { hasRatedOrganizer: boolean; canRateOrganizer: boolean } {
  if (input.hasExistingRating) {
    return { hasRatedOrganizer: true, canRateOrganizer: false };
  }

  if (input.viewerId === input.organizerId) {
    return { hasRatedOrganizer: false, canRateOrganizer: false };
  }

  const att = input.attendanceStatus;
  if (!att || att === AttendanceStatus.LEFT) {
    return { hasRatedOrganizer: false, canRateOrganizer: false };
  }

  const es = input.eventStatus;
  if (es !== EventStatus.COMPLETED && es !== EventStatus.FINALIZED) {
    return { hasRatedOrganizer: false, canRateOrganizer: false };
  }

  if (att === AttendanceStatus.CONFIRMED) {
    return { hasRatedOrganizer: false, canRateOrganizer: true };
  }

  if (att === AttendanceStatus.JOINED && es === EventStatus.FINALIZED) {
    return { hasRatedOrganizer: false, canRateOrganizer: true };
  }

  return { hasRatedOrganizer: false, canRateOrganizer: false };
}
