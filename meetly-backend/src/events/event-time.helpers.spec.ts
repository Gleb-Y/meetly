import { EventStatus } from '@prisma/client';
import {
  getEffectiveEndAt,
  getEffectiveStartAt,
  getOrganizerMarkAttendanceUi,
  parseEventInstantOrThrow,
  startOfDayUtc,
} from './event-time.helpers';

describe('event-time.helpers', () => {
  describe('parseEventInstantOrThrow', () => {
    it('accepts Z suffix', () => {
      const d = parseEventInstantOrThrow('2026-03-31T07:00:00.000Z');
      expect(d.toISOString()).toBe('2026-03-31T07:00:00.000Z');
    });

    it('accepts numeric offset', () => {
      const d = parseEventInstantOrThrow('2026-03-31T12:00:00+05:00');
      expect(Number.isNaN(d.getTime())).toBe(false);
    });

    it('rejects datetime without timezone', () => {
      expect(() =>
        parseEventInstantOrThrow('2026-03-31T07:00:00'),
      ).toThrow();
    });

    it('rejects date-only', () => {
      expect(() => parseEventInstantOrThrow('2026-03-31')).toThrow();
    });
  });

  describe('getEffectiveStartAt / getEffectiveEndAt', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    const start = new Date('2026-01-01T10:00:00.000Z');
    const end = new Date('2026-01-01T18:00:00.000Z');

    it('uses startTime / endTime when set', () => {
      expect(getEffectiveStartAt({ date, startTime: start, endTime: end })).toBe(
        start,
      );
      expect(getEffectiveEndAt({ date, startTime: start, endTime: end })).toBe(
        end,
      );
    });

    it('falls back to date', () => {
      expect(
        getEffectiveStartAt({ date, startTime: null, endTime: null }),
      ).toBe(date);
      expect(getEffectiveEndAt({ date, startTime: null, endTime: null })).toBe(
        date,
      );
    });
  });

  describe('startOfDayUtc', () => {
    it('returns UTC midnight for the given instant’s calendar day', () => {
      const d = new Date('2026-06-15T14:30:00.000Z');
      const sod = startOfDayUtc(d);
      expect(sod.toISOString()).toBe('2026-06-15T00:00:00.000Z');
    });
  });

  describe('getOrganizerMarkAttendanceUi', () => {
    const base = {
      creatorId: 'org',
      status: EventStatus.ACTIVE,
      date: new Date('2026-06-15T12:00:00.000Z'),
      startTime: new Date('2026-06-15T10:00:00.000Z'),
      endTime: new Date('2026-06-15T12:00:00.000Z'),
      earlyMinutes: 10,
    };

    it('hides button for non-organizer', () => {
      const ui = getOrganizerMarkAttendanceUi({
        ...base,
        viewerId: 'guest',
        now: new Date('2026-06-15T11:55:00.000Z'),
      });
      expect(ui.showMarkAttendanceButton).toBe(false);
      expect(ui.markAttendanceOpensAt).toBeNull();
    });

    it('shows button for organizer within window before end', () => {
      const ui = getOrganizerMarkAttendanceUi({
        ...base,
        viewerId: 'org',
        now: new Date('2026-06-15T11:55:00.000Z'),
      });
      expect(ui.showMarkAttendanceButton).toBe(true);
    });

    it('hides when before open window', () => {
      const ui = getOrganizerMarkAttendanceUi({
        ...base,
        viewerId: 'org',
        now: new Date('2026-06-15T11:44:59.000Z'),
      });
      expect(ui.showMarkAttendanceButton).toBe(false);
    });
  });
});
