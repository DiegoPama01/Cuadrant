export type PlanningStatus = 'draft' | 'published' | 'archived';
export type ContractType = 'full_time' | 'part_time' | 'temporary' | 'internship' | 'other';
export type AvailabilityStatus = 'available' | 'unavailable' | 'preferred';
export type TimeOffStatus = 'requested' | 'approved' | 'rejected' | 'cancelled';
export type TimeBalanceEntryKind = 'accrual' | 'usage' | 'adjustment' | 'carryover';

export interface Contract {
  id: string;
  installation?: string | null;
  employee: string;
  contract_type?: ContractType | string | null;
  start_date: string;
  end_date?: string | null;
  weekly_hours?: number | null;
  daily_hours?: number | null;
  active: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeePosition {
  id: string;
  employee: string;
  position: string;
  priority?: number | null;
  primary?: boolean;
  proficiency?: string | null;
  active?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeZone {
  id: string;
  employee: string;
  zone: string;
  preferred?: boolean;
  active?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeAvailability {
  id: string;
  employee: string;
  day_of_week?: number;
  weekday?: number;
  shift?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status?: AvailabilityStatus | string;
  available?: boolean;
  notes?: string | null;
}

export interface EmployeeAvailabilityException {
  id: string;
  employee: string;
  work_date?: string;
  date?: string;
  shift?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status?: AvailabilityStatus | string;
  available?: boolean;
  reason?: string | null;
  notes?: string | null;
}

export interface EmployeeTimeOff {
  id: string;
  employee: string;
  start_date: string;
  end_date: string;
  status: TimeOffStatus | string;
  reason?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TimeBalanceEntry {
  id: string;
  employee: string;
  entry_date: string;
  kind: TimeBalanceEntryKind | string;
  minutes: number;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Planning {
  id: string;
  installation?: string | null;
  name?: string | null;
  week_start: string;
  week_end?: string;
  status?: PlanningStatus | string;
  created_at?: string;
  updated_at?: string;
}

export interface Assignment {
  id: string;
  planning?: string | null;
  employee: string;
  date?: string;
  work_date: string;
  zone: string;
  shift: string;
  position: string;
  notes?: string | null;
  note?: string;
  created_at?: string;
  updated_at?: string;
}

export type PlanningAssignment = Assignment;

export interface StaffRequirement {
  id: string;
  installation?: string;
  day_of_week?: number | null;
  date?: string | null;
  position: string;
  zone: string;
  shift: string;
  required_employees: number;
  minimum_employees?: number | null;
  notes?: string | null;
  active: boolean;
}

export interface PlanningWeekResponse {
  planning?: Planning | null;
  week_start: string;
  week_end: string;
  assignments: PlanningAssignment[];
  requirements?: StaffRequirement[];
  staff_requirements?: StaffRequirement[];
  contracts?: Contract[];
  employee_positions?: EmployeePosition[];
  employee_zones?: EmployeeZone[];
  employee_availabilities?: EmployeeAvailability[];
  employee_availability_exceptions?: EmployeeAvailabilityException[];
  employee_time_offs?: EmployeeTimeOff[];
  time_balance_entries?: TimeBalanceEntry[];
}

export interface PlanningZoneShift {
  id: string;
  zone: string;
  shift: string;
  active: boolean;
  sort_order: number;
}

export interface PlanningWeekWriteAssignment {
  id?: string;
  planning?: string | null;
  employee: string;
  date: string;
  zone: string;
  shift: string;
  position: string;
  notes?: string;
}

export interface PlanningWeekWritePayload {
  assignments: PlanningWeekWriteAssignment[];
}
