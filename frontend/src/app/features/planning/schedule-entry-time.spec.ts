import { describe, expect, it } from 'vitest';
import { localScheduleDatetimes } from './schedule-entry-time';

describe('localScheduleDatetimes', () => {
  it('keeps a same-day end time on the entry date', () => {
    expect(localScheduleDatetimes('2026-10-12', '09:00', '17:30')).toEqual({
      startsAt: '2026-10-12T09:00:00',
      endsAt: '2026-10-12T17:30:00',
    });
  });

  it('moves an overnight end time to the following local day', () => {
    expect(localScheduleDatetimes('2026-10-12', '22:00', '06:00')).toEqual({
      startsAt: '2026-10-12T22:00:00',
      endsAt: '2026-10-13T06:00:00',
    });
  });

  it('treats an equal start and end time as overnight', () => {
    expect(localScheduleDatetimes('2026-12-31', '00:00', '00:00')).toEqual({
      startsAt: '2026-12-31T00:00:00',
      endsAt: '2027-01-01T00:00:00',
    });
  });
});
