export interface InstallationSummary {
  id: string;
  company?: string;
  name: string;
  code?: string | null;
  address?: string | null;
  timezone?: string | null;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface InstallationUpsertPayload {
  name: string;
  code?: string | null;
  address?: string | null;
  timezone?: string | null;
  active?: boolean;
}

export interface InstallationOption {
  id: string;
  name: string;
}
