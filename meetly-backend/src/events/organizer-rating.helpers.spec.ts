import { AttendanceStatus, EventStatus } from '@prisma/client';
import { organizerRatingViewerState } from './organizer-rating.helpers';

describe('organizerRatingViewerState', () => {
  const base = {
    viewerId: 'u1',
    organizerId: 'org',
    hasExistingRating: false,
  };

  it('returns hasRated and no canRate when rating exists', () => {
    expect(
      organizerRatingViewerState({
        ...base,
        eventStatus: EventStatus.FINALIZED,
        attendanceStatus: AttendanceStatus.JOINED,
        hasExistingRating: true,
      }),
    ).toEqual({ hasRatedOrganizer: true, canRateOrganizer: false });
  });

  it('organizer cannot rate', () => {
    expect(
      organizerRatingViewerState({
        viewerId: 'org',
        organizerId: 'org',
        eventStatus: EventStatus.FINALIZED,
        attendanceStatus: AttendanceStatus.CONFIRMED,
        hasExistingRating: false,
      }),
    ).toEqual({ hasRatedOrganizer: false, canRateOrganizer: false });
  });

  it('LEFT cannot rate', () => {
    expect(
      organizerRatingViewerState({
        ...base,
        eventStatus: EventStatus.FINALIZED,
        attendanceStatus: AttendanceStatus.LEFT,
        hasExistingRating: false,
      }),
    ).toEqual({ hasRatedOrganizer: false, canRateOrganizer: false });
  });

  it('ACTIVE event cannot rate', () => {
    expect(
      organizerRatingViewerState({
        ...base,
        eventStatus: EventStatus.ACTIVE,
        attendanceStatus: AttendanceStatus.CONFIRMED,
        hasExistingRating: false,
      }),
    ).toEqual({ hasRatedOrganizer: false, canRateOrganizer: false });
  });

  it('CONFIRMED can rate when COMPLETED', () => {
    expect(
      organizerRatingViewerState({
        ...base,
        eventStatus: EventStatus.COMPLETED,
        attendanceStatus: AttendanceStatus.CONFIRMED,
        hasExistingRating: false,
      }),
    ).toEqual({ hasRatedOrganizer: false, canRateOrganizer: true });
  });

  it('CONFIRMED can rate when FINALIZED', () => {
    expect(
      organizerRatingViewerState({
        ...base,
        eventStatus: EventStatus.FINALIZED,
        attendanceStatus: AttendanceStatus.CONFIRMED,
        hasExistingRating: false,
      }),
    ).toEqual({ hasRatedOrganizer: false, canRateOrganizer: true });
  });

  it('JOINED cannot rate when COMPLETED', () => {
    expect(
      organizerRatingViewerState({
        ...base,
        eventStatus: EventStatus.COMPLETED,
        attendanceStatus: AttendanceStatus.JOINED,
        hasExistingRating: false,
      }),
    ).toEqual({ hasRatedOrganizer: false, canRateOrganizer: false });
  });

  it('JOINED can rate when FINALIZED', () => {
    expect(
      organizerRatingViewerState({
        ...base,
        eventStatus: EventStatus.FINALIZED,
        attendanceStatus: AttendanceStatus.JOINED,
        hasExistingRating: false,
      }),
    ).toEqual({ hasRatedOrganizer: false, canRateOrganizer: true });
  });

  it('missing attendance cannot rate', () => {
    expect(
      organizerRatingViewerState({
        ...base,
        eventStatus: EventStatus.FINALIZED,
        attendanceStatus: null,
        hasExistingRating: false,
      }),
    ).toEqual({ hasRatedOrganizer: false, canRateOrganizer: false });
  });
});
