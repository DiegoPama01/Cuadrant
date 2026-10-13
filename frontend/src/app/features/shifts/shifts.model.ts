export interface ShiftTemplate {
  id: string;
  installation?: string | null;
  name: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  break_minutes?: number;
  color: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShiftTemplateUpsertPayload {
  name: string;
  description: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  color: string;
  active: boolean;
}
