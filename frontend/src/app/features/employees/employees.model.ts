import type { Contract, EmployeeAvailability, EmployeePosition, EmployeeZone } from '../planning/planning.model';

export interface Employee {
  id: string;
  installation?: string | null;
  user?: number | null;
  employee_code?: string | null;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  hire_date?: string | null;
  termination_date?: string | null;
  color?: string | null;
  notes?: string | null;
  active: boolean;
  all_zones?: boolean;
  availability_unrestricted?: boolean;
  created_at?: string;
  updated_at?: string;
  position: string;
  allowed_zones: string[];
  contracts?: Contract[];
  availabilities?: EmployeeAvailability[];
  positions?: EmployeePosition[];
  employee_positions?: EmployeePosition[];
  zones?: EmployeeZone[];
  employee_zones?: EmployeeZone[];
}

export type EmployeeZoneMode = 'all' | 'custom';
export type EmployeeAvailabilityMode = 'unrestricted' | 'custom';

export interface EmployeeContractFormPayload {
  id?: string;
  weekly_hours: number | null;
  start_date: string;
  end_date: string;
  active: boolean;
}

export interface EmployeePositionFormPayload {
  id?: string;
  position: string;
  primary: boolean;
}

export interface EmployeeZoneFormPayload {
  id?: string;
  zone: string;
  preferred?: boolean;
}

export interface EmployeeAvailabilityFormPayload {
  id?: string;
  day_of_week: number;
  available: boolean;
  start_time: string;
  end_time: string;
}

export interface EmployeeUpsertPayload {
  installation?: string;
  employee_code: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  hire_date: string;
  termination_date: string;
  color: string;
  notes: string;
  active: boolean;
  position: string;
  allowed_zones: string[];
  contract: EmployeeContractFormPayload;
  employee_positions: EmployeePositionFormPayload[];
  zone_mode: EmployeeZoneMode;
  employee_zones: EmployeeZoneFormPayload[];
  availability_mode: EmployeeAvailabilityMode;
  availabilities: EmployeeAvailabilityFormPayload[];
  grant_quadrant_access: boolean;
}

export interface ContractUpsertPayload {
  employee: string;
  start_date: string;
  end_date?: string | null;
  weekly_hours: number;
  active: boolean;
}

export interface EmployeePositionUpsertPayload {
  employee: string;
  position: string;
  primary: boolean;
}

export interface EmployeeZoneUpsertPayload {
  employee: string;
  zone: string;
  preferred: boolean;
}

export interface EmployeeAvailabilityUpsertPayload {
  employee: string;
  day_of_week: number;
  available: boolean;
  start_time?: string | null;
  end_time?: string | null;
}
