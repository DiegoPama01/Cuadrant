import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { API_BASE_URL } from '../api/api.config';
import { AuthService } from '../auth/auth.service';
import { Company, CompanyUpsertPayload } from './company.model';

@Injectable({
  providedIn: 'root',
})
export class CompanyService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly authService = inject(AuthService);
  private readonly listCache = new Map<string, Observable<Company[]>>();
  private readonly resourceCache = new Map<string, Observable<Company>>();

  list(): Observable<Company[]> {
    const url = `${this.apiBaseUrl}/companies/`;
    const cached = this.listCache.get(url);

    if (cached) {
      return cached;
    }

    const request = this.http.get<Company[]>(url).pipe(shareReplay({ bufferSize: 1, refCount: false }));
    this.listCache.set(url, request);

    return request;
  }

  get(companyId: string): Observable<Company> {
    const url = `${this.apiBaseUrl}/companies/${companyId}/`;
    const cached = this.resourceCache.get(url);

    if (cached) {
      return cached;
    }

    const request = this.http.get<Company>(url).pipe(shareReplay({ bufferSize: 1, refCount: false }));
    this.resourceCache.set(url, request);

    return request;
  }

  create(payload: CompanyUpsertPayload): Observable<Company> {
    return this.http.post<Company>(`${this.apiBaseUrl}/companies/`, payload).pipe(tap(() => this.invalidateCompanies()));
  }

  update(companyId: string, payload: CompanyUpsertPayload): Observable<Company> {
    return this.http.patch<Company>(`${this.apiBaseUrl}/companies/${companyId}/`, payload).pipe(tap(() => this.invalidateCompanies()));
  }

  getActiveCompanyId(): string | null {
    return this.authService.activeCompany()?.id ?? null;
  }

  getActiveInstallationId(): string | null {
    return this.authService.activeInstallationId();
  }

  setActiveInstallationId(installationId: string | null): void {
    this.authService.setActiveInstallationId(installationId);
  }

  getRequiredCompanyId(): string {
    const companyId = this.getActiveCompanyId();

    if (!companyId) {
      throw new Error('An active company is required to access company-scoped resources.');
    }

    return companyId;
  }

  buildCompanyApiUrl(resourcePath: string): string {
    const normalizedResourcePath = resourcePath.replace(/^\/+|\/+$/g, '');

    return `${this.apiBaseUrl}/companies/${this.getRequiredCompanyId()}/${normalizedResourcePath}/`;
  }

  buildCompanyResourceUrl(resourcePath: string, resourceId: string): string {
    return `${this.buildCompanyApiUrl(resourcePath)}${resourceId}/`;
  }

  private invalidateCompanies(): void {
    this.listCache.clear();
    this.resourceCache.clear();
  }
}
