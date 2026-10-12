/** Formats a Date using local calendar fields rather than UTC fields. */
export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Builds a local, timezone-free ISO datetime accepted by the scheduling API.
 * An end time equal to or before the start time belongs to the following day.
 */
export function localScheduleDatetimes(date: string, startsAt: string, endsAt: string): {
  startsAt: string;
  endsAt: string;
} {
  const startTime = normalizeTime(startsAt);
  const endTime = normalizeTime(endsAt);
  const endDate = endTime <= startTime ? addDays(date, 1) : date;

  return {
    startsAt: `${date}T${startTime}:00`,
    endsAt: `${endDate}T${endTime}:00`,
  };
}

export function timeFromDateTime(value: string): string {
  const match = /T(\d{2}:\d{2})/.exec(value);
  return match?.[1] ?? value.slice(11, 16);
}

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

function addDays(date: string, days: number): string {
  const local = new Date(`${date}T12:00:00`);
  local.setDate(local.getDate() + days);
  return localDate(local);
}
