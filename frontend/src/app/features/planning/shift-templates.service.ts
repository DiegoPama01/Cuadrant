import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { CompanyService } from '../../core/company/company.service';
import { ShiftTemplate, ShiftTemplateUpsertPayload } from '../shifts/shifts.model';

@Injectable({ providedIn: 'root' })
export class ShiftTemplatesService {
  private readonly http = inject(HttpClient);
  private readonly companyService = inject(CompanyService);
  private readonly cache = new Map<string, Observable<ShiftTemplate[]>>();
  private readonly resourceCache = new Map<string, Observable<ShiftTemplate>>();

  list(): Observable<ShiftTemplate[]> {
    const url = this.companyService.buildInstallationApiUrl('shift-templates');
    const cached = this.cache.get(url);
    if (cached) return cached;

    const request = this.http
      .get<ShiftTemplate[]>(url)
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    this.cache.set(url, request);
    return request;
  }

  get(shiftTemplateId: string): Observable<ShiftTemplate> {
    const url = this.companyService.buildInstallationResourceUrl('shift-templates', shiftTemplateId);
    const cached = this.resourceCache.get(url);
    if (cached) return cached;

    const request = this.http.get<ShiftTemplate>(url).pipe(shareReplay({ bufferSize: 1, refCount: false }));
    this.resourceCache.set(url, request);
    return request;
  }

  create(payload: ShiftTemplateUpsertPayload): Observable<ShiftTemplate> {
    const url = this.companyService.buildInstallationApiUrl('shift-templates');
    return this.http.post<ShiftTemplate>(url, payload).pipe(tap(() => this.invalidate(url)));
  }

  update(shiftTemplateId: string, payload: ShiftTemplateUpsertPayload): Observable<ShiftTemplate> {
    const collectionUrl = this.companyService.buildInstallationApiUrl('shift-templates');
    const url = this.companyService.buildInstallationResourceUrl('shift-templates', shiftTemplateId);
    return this.http.put<ShiftTemplate>(url, payload).pipe(tap(() => this.invalidate(collectionUrl)));
  }

  delete(shiftTemplateId: string): Observable<void> {
    const collectionUrl = this.companyService.buildInstallationApiUrl('shift-templates');
    const url = this.companyService.buildInstallationResourceUrl('shift-templates', shiftTemplateId);
    return this.http.delete<void>(url).pipe(tap(() => this.invalidate(collectionUrl)));
  }

  private invalidate(collectionUrl: string): void {
    this.cache.delete(collectionUrl);
    for (const resourceUrl of this.resourceCache.keys()) {
      if (resourceUrl.startsWith(collectionUrl)) this.resourceCache.delete(resourceUrl);
    }
  }
}
