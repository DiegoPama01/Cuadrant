import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { CompanyService } from './company.service';
import { InstallationSummary, InstallationUpsertPayload } from './installation.model';

@Injectable({
  providedIn: 'root',
})
export class InstallationsService {
  private readonly http = inject(HttpClient);
  private readonly companyService = inject(CompanyService);
  private readonly companyListCache = new Map<string, Observable<InstallationSummary[]>>();
  private readonly resourceCache = new Map<string, Observable<InstallationSummary>>();

  listForActiveCompany(): Observable<InstallationSummary[]> {
    const url = this.companyService.buildCompanyApiUrl('installations');
    const cached = this.companyListCache.get(url);

    if (cached) {
      return cached;
    }

    const request = this.http
      .get<InstallationSummary[]>(url)
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    this.companyListCache.set(url, request);

    return request;
  }

  get(installationId: string): Observable<InstallationSummary> {
    const url = this.companyService.buildCompanyResourceUrl('installations', installationId);
    const cached = this.resourceCache.get(url);

    if (cached) {
      return cached;
    }

    const request = this.http
      .get<InstallationSummary>(url)
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    this.resourceCache.set(url, request);

    return request;
  }

  create(payload: InstallationUpsertPayload): Observable<InstallationSummary> {
    const collectionUrl = this.companyService.buildCompanyApiUrl('installations');

    return this.http
      .post<InstallationSummary>(collectionUrl, payload)
      .pipe(tap(() => this.invalidateCollection(collectionUrl)));
  }

  update(installationId: string, payload: InstallationUpsertPayload): Observable<InstallationSummary> {
    const collectionUrl = this.companyService.buildCompanyApiUrl('installations');
    const resourceUrl = this.companyService.buildCompanyResourceUrl('installations', installationId);

    return this.http
      .patch<InstallationSummary>(resourceUrl, payload)
      .pipe(tap(() => this.invalidateCollection(collectionUrl)));
  }

  delete(installationId: string): Observable<void> {
    const collectionUrl = this.companyService.buildCompanyApiUrl('installations');
    const resourceUrl = this.companyService.buildCompanyResourceUrl('installations', installationId);

    return this.http
      .delete<void>(resourceUrl)
      .pipe(tap(() => this.invalidateCollection(collectionUrl)));
  }

  private invalidateCollection(collectionUrl: string): void {
    this.companyListCache.delete(collectionUrl);

    for (const resourceUrl of this.resourceCache.keys()) {
      if (resourceUrl.startsWith(collectionUrl)) {
        this.resourceCache.delete(resourceUrl);
      }
    }
  }
}
