export interface Shift {
  id: string;
  installation?: string | null;
  name: string;
  code?: string | null;
  start_time: string;
  end_time: string;
  break_minutes?: number;
  color: string;
  sort_order?: number;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ShiftUpsertPayload {
  installation?: string;
  name: string;
  code: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  color: string;
  sort_order: number;
  active: boolean;
}
