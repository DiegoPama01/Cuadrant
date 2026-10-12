export interface EmployeeJobRolePayload {
  job_role: string;
  primary: boolean;
  proficiency: string | null;
}

export interface EmploymentContract {
  id: string;
  weekly_hours: number | null;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
}

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
  active: boolean;
  created_at?: string;
  updated_at?: string;
  job_roles: EmployeeJobRolePayload[];
  contract?: EmploymentContract | null;
}

export interface EmployeeUpsertPayload {
  full_name: string;
  email: string;
  phone: string;
  color: string;
  active: boolean;
  job_roles: EmployeeJobRolePayload[];
}
