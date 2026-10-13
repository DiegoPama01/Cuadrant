export interface ScheduleEntry {
  id: string;
  employee: string;
  /** Local calendar date on which the entry starts (YYYY-MM-DD). */
  date: string;
  starts_at: string;
  ends_at: string;
  job_role: string;
  work_area?: string | null;
  shift_template?: string | null;
  notes?: string | null;
}

export interface ScheduleEntryUpsertPayload {
  employee: string;
  date: string;
  starts_at: string;
  ends_at: string;
  job_role: string;
  work_area?: string | null;
  notes?: string;
}

export type { ShiftTemplate } from '../shifts/shifts.model';
