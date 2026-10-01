export interface Position {
  id: string;
  installation?: string | null;
  name: string;
  code?: string | null;
  description?: string | null;
  color: string;
  sort_order?: number;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PositionUpsertPayload {
  installation?: string;
  name: string;
  code: string;
  description: string;
  color: string;
  sort_order: number;
  active: boolean;
}
