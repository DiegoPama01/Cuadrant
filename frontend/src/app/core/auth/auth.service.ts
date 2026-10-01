import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  catchError,
  finalize,
  firstValueFrom,
  map,
  Observable,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';

import { API_BASE_URL } from '../api/api.config';
import { RuntimeConfigService } from '../config/runtime-config.service';
import { AuthContextService } from './auth-context.service';
import {
  CompanyMembership,
  LoginRequest,
  OidcCodeExchangeRequest,
  SignupRequest,
  TokenRefreshResponse,
  TokenResponse,
  User,
} from './auth.model';

type PendingOidcLogin = {
  state: string;
  codeVerifier: string;
  redirectUri: string;
};

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_BASE_URL);
  private readonly runtimeConfig = inject(RuntimeConfigService);
  private readonly authContext = inject(AuthContextService);
  private readonly pendingOidcLoginStorageKey = 'planning_app.pending_oidc_login';
  private readonly accessTokenExpiresAtStorageKey = 'access_token_expires_at';
  private refreshRequest$: Observable<string> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  currentUser = this.authContext.currentUser;
  activeCompany = this.authContext.activeCompany;
  activeInstallationId = this.authContext.activeInstallationId;

  constructor() {
    this.scheduleStoredTokenRefresh();
  }

  login(_credentials: LoginRequest): Observable<never> {
    return new Observable((subscriber) => {
      void this.startOidcLogin();
      subscriber.complete();
    });
  }

  signup(payload: SignupRequest) {
    return this.http.post<TokenResponse>(`${this.apiUrl}/auth/signup/`, payload).pipe(
      tap((tokens) => {
        this.storeTokens(tokens);
      }),
    );
  }

  loadCurrentUser() {
    return this.http.get<User>(`${this.apiUrl}/auth/me/`).pipe(
      tap((user) => {
        const activeCompany = this.resolveActiveCompany(user, this.activeCompany());
        this.authContext.setSession(user, activeCompany);
      }),
    );
  }

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem(this.accessTokenExpiresAtStorageKey);
    this.clearRefreshTimer();
    this.refreshRequest$ = null;
    this.authContext.clear();
  }

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  async startOidcLogin(loginHint?: string): Promise<void> {
    const pendingLogin = await this.createPendingOidcLogin();
    sessionStorage.setItem(this.pendingOidcLoginStorageKey, JSON.stringify(pendingLogin));
    window.location.href = await this.buildAuthorizeUrl(pendingLogin, loginHint);
  }

  exchangeOidcCode(payload: OidcCodeExchangeRequest) {
    return this.http.post<TokenResponse>(`${this.apiUrl}/auth/oidc/exchange/`, payload).pipe(
      tap((tokens) => {
        this.storeTokens(tokens);
        sessionStorage.removeItem(this.pendingOidcLoginStorageKey);
      }),
    );
  }

  consumePendingOidcLogin(expectedState: string): PendingOidcLogin | null {
    const rawValue = sessionStorage.getItem(this.pendingOidcLoginStorageKey);
    if (!rawValue) {
      return null;
    }

    try {
      const parsedValue = JSON.parse(rawValue) as Partial<PendingOidcLogin>;
      if (
        typeof parsedValue.state !== 'string' ||
        typeof parsedValue.codeVerifier !== 'string' ||
        typeof parsedValue.redirectUri !== 'string' ||
        parsedValue.state !== expectedState
      ) {
        sessionStorage.removeItem(this.pendingOidcLoginStorageKey);
        return null;
      }

      return {
        state: parsedValue.state,
        codeVerifier: parsedValue.codeVerifier,
        redirectUri: parsedValue.redirectUri,
      };
    } catch {
      sessionStorage.removeItem(this.pendingOidcLoginStorageKey);
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  hydrateContext(): void {
    this.authContext.hydrate();
  }

  async syncSession(): Promise<void> {
    this.hydrateContext();

    if (!this.getAccessToken()) {
      return;
    }

    try {
      await firstValueFrom(this.loadCurrentUser());
    } catch {
      this.logout();
    }
  }

  setActiveCompany(company: CompanyMembership | null): void {
    this.authContext.setActiveCompany(company);
  }

  setActiveInstallationId(installationId: string | null): void {
    this.authContext.setActiveInstallationId(installationId);
  }

  refreshAccessToken(): Observable<string> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      this.logout();
      return throwError(() => new Error('Missing refresh token.'));
    }

    if (this.refreshRequest$) {
      return this.refreshRequest$;
    }

    this.refreshRequest$ = this.http
      .post<TokenRefreshResponse>(`${this.apiUrl}/auth/oidc/refresh/`, {
        refresh_token: refreshToken,
      })
      .pipe(
        tap((response) => {
          if (!response.access) {
            throw new Error('Refresh response did not contain an access token.');
          }

          this.storeTokens(response, true);
        }),
        map((response) => response.access),
        catchError((error) => {
          this.logout();
          return throwError(() => error);
        }),
        finalize(() => {
          this.refreshRequest$ = null;
        }),
        shareReplay(1),
      );

    return this.refreshRequest$;
  }

  private resolveActiveCompany(user: User, currentCompany: CompanyMembership | null): CompanyMembership | null {
    if (!currentCompany) {
      return user.companies[0] ?? null;
    }

    return user.companies.find((company) => company.id === currentCompany.id) ?? user.companies[0] ?? null;
  }

  private storeTokens(tokens: TokenResponse, preserveRefreshToken = false): void {
    if (tokens.access) {
      localStorage.setItem('access_token', tokens.access);
      this.scheduleTokenRefresh(tokens.access, tokens.expires_in);
    }

    if (tokens.refresh) {
      localStorage.setItem('refresh_token', tokens.refresh);
      return;
    }

    if (!preserveRefreshToken) {
      localStorage.removeItem('refresh_token');
    }
  }

  private scheduleStoredTokenRefresh(): void {
    const accessToken = this.getAccessToken();
    if (!accessToken) {
      return;
    }

    const storedExpiration = Number(localStorage.getItem(this.accessTokenExpiresAtStorageKey));
    if (Number.isFinite(storedExpiration) && storedExpiration > 0) {
      this.scheduleRefreshAt(storedExpiration);
      return;
    }

    this.scheduleTokenRefresh(accessToken, null);
  }

  private scheduleTokenRefresh(accessToken: string, expiresIn: number | null | undefined): void {
    const tokenExpiration = this.readTokenExpiration(accessToken);
    const expiresAt = tokenExpiration ?? (
      typeof expiresIn === 'number' && expiresIn > 0 ? Date.now() + expiresIn * 1000 : null
    );

    if (!expiresAt) {
      return;
    }

    localStorage.setItem(this.accessTokenExpiresAtStorageKey, String(expiresAt));
    this.scheduleRefreshAt(expiresAt);
  }

  private scheduleRefreshAt(expiresAt: number): void {
    this.clearRefreshTimer();

    const refreshDelay = Math.max(expiresAt - Date.now() - 30_000, 1_000);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      if (this.getRefreshToken()) {
        this.refreshAccessToken().subscribe({ error: () => undefined });
      }
    }, refreshDelay);
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private readTokenExpiration(token: string): number | null {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    try {
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))) as {
        exp?: unknown;
      };
      return typeof decoded.exp === 'number' && decoded.exp > 0 ? decoded.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  private async createPendingOidcLogin(): Promise<PendingOidcLogin> {
    const state = this.createRandomString(32);
    const codeVerifier = this.createRandomString(64);
    const redirectUri = this.runtimeConfig.getConfig().auth.redirectUri;

    return {
      state,
      codeVerifier,
      redirectUri,
    };
  }

  private async buildAuthorizeUrl(pendingLogin: PendingOidcLogin, loginHint?: string): Promise<string> {
    const { auth } = this.runtimeConfig.getConfig();
    const authorizeUrl = new URL('/application/o/authorize/', this.getAuthentikOrigin());
    authorizeUrl.searchParams.set('client_id', auth.clientId);
    authorizeUrl.searchParams.set('redirect_uri', pendingLogin.redirectUri);
    authorizeUrl.searchParams.set('response_type', auth.responseType);
    authorizeUrl.searchParams.set('scope', auth.scopes);
    authorizeUrl.searchParams.set('state', pendingLogin.state);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');
    authorizeUrl.searchParams.set('code_challenge', await this.createCodeChallenge(pendingLogin.codeVerifier));
    if (loginHint) {
      authorizeUrl.searchParams.set('login_hint', loginHint);
    }
    return authorizeUrl.toString();
  }

  private getAuthentikOrigin(): string {
    const issuerUrl = this.runtimeConfig.getConfig().auth.issuerUrl;
    if (!issuerUrl) {
      throw new Error('Missing Authentik issuer URL.');
    }

    const parsedUrl = new URL(issuerUrl);
    return `${parsedUrl.protocol}//${parsedUrl.host}`;
  }

  private async createCodeChallenge(codeVerifier: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
    return this.encodeBase64Url(new Uint8Array(digest));
  }

  private createRandomString(length: number): string {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return this.encodeBase64Url(bytes);
  }

  private encodeBase64Url(bytes: Uint8Array): string {
    const value = btoa(String.fromCharCode(...bytes));
    return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
}
