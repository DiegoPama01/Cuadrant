import { timeFromDateTime } from './schedule-entry-time';
import { ScheduleEntry } from './schedule-entry.model';

export function buildScheduleEntriesCsv(
  entries: readonly ScheduleEntry[],
  employeeNames: ReadonlyMap<string, string>,
  roleNames: ReadonlyMap<string, string>,
): string {
  const rows = [...entries]
    .sort((left, right) =>
      `${employeeNames.get(left.employee) ?? left.employee}\u0000${left.date}\u0000${left.starts_at}`.localeCompare(
        `${employeeNames.get(right.employee) ?? right.employee}\u0000${right.date}\u0000${right.starts_at}`,
      ),
    )
    .map((entry) => [
      employeeNames.get(entry.employee) ?? entry.employee,
      entry.date.slice(0, 10),
      timeFromDateTime(entry.starts_at),
      timeFromDateTime(entry.ends_at),
      roleNames.get(entry.job_role) ?? entry.job_role,
      entry.notes ?? '',
    ]);

  return [['Employee', 'Date', 'Start', 'End', 'Job role', 'Notes'], ...rows]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\r\n');
}

function escapeCsvValue(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
