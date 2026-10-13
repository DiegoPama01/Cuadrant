import { describe, expect, it } from 'vitest';
import { buildScheduleEntriesCsv } from './schedule-entry-export';
import { ScheduleEntry } from './schedule-entry.model';

describe('buildScheduleEntriesCsv', () => {
  it('exports weekly entries by employee, date and original local times', () => {
    const entries: ScheduleEntry[] = [
      {
        id: 'entry-2',
        employee: 'employee-2',
        date: '2026-10-13',
        starts_at: '2026-10-13T22:00:00',
        ends_at: '2026-10-14T06:00:00',
        job_role: 'role-2',
        notes: 'Night, cover',
      },
      {
        id: 'entry-1',
        employee: 'employee-1',
        date: '2026-10-12',
        starts_at: '2026-10-12T09:00:00',
        ends_at: '2026-10-12T17:00:00',
        job_role: 'role-1',
        notes: null,
      },
    ];

    expect(
      buildScheduleEntriesCsv(
        entries,
        new Map([
          ['employee-1', 'Ada Lovelace'],
          ['employee-2', 'Grace Hopper'],
        ]),
        new Map([
          ['role-1', 'Reception'],
          ['role-2', 'Night manager'],
        ]),
      ),
    ).toBe(
      'Employee,Date,Start,End,Job role,Notes\r\n' +
        'Ada Lovelace,2026-10-12,09:00,17:00,Reception,\r\n' +
        'Grace Hopper,2026-10-13,22:00,06:00,Night manager,"Night, cover"',
    );
  });
});
