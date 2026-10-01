export interface CompanyMembership {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'admin' | 'member';
  permissions?: string[];
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  companies: CompanyMembership[];
}

export interface TokenResponse {
  access?: string;
  refresh?: string;
  expires_in?: number | null;
  token_type?: string;
  account_created?: boolean;
  login_succeeded?: boolean;
  login_error?: string | null;
}

export interface TokenRefreshResponse {
  access: string;
  refresh?: string;
  expires_in?: number | null;
  token_type?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
  confirm_password: string;
}

export interface OidcCodeExchangeRequest {
  code: string;
  code_verifier: string;
  redirect_uri: string;
}

export type AuthSessionProvider = 'local' | 'authentik';
