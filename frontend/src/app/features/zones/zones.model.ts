export interface Zone {
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
  staff_requirements?: ZoneStaffRequirementGroup[];
}

export interface ZoneStaffRequirementGroup {
  id: string;
  shift: string;
  positions: ZonePositionRequirement[];
}

export interface ZonePositionRequirement {
  position: string;
  required_count: number;
}

export interface ZoneUpsertPayload {
  installation?: string;
  name: string;
  code: string;
  description: string;
  color: string;
  sort_order: number;
  active: boolean;
  staff_requirements: ZoneStaffRequirementInput[];
}

export interface ZoneStaffRequirementInput {
  shift: string;
  positions: ZonePositionRequirement[];
}
