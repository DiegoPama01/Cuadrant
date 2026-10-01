export interface Company {
  id: string;
  name: string;
  slug?: string;
  legal_name?: string | null;
  tax_id?: string | null;
  timezone?: string | null;
  active?: boolean;
  permissions?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface CompanyUpsertPayload {
  name: string;
  legal_name?: string | null;
  tax_id?: string | null;
  timezone?: string | null;
  active?: boolean;
}
