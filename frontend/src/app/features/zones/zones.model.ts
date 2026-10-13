export interface WorkArea {
  id: string;
  installation?: string | null;
  name: string;
  description?: string | null;
  color: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkAreaUpsertPayload {
  name: string;
  description: string;
  color: string;
  active: boolean;
}
