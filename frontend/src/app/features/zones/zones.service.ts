import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';
import { CompanyService } from '../../core/company/company.service';
import { WorkArea, WorkAreaUpsertPayload } from './zones.model';

@Injectable({
  providedIn: 'root',
})
export class WorkAreasService {
  private readonly http = inject(HttpClient);
  private readonly companyService = inject(CompanyService);
  private readonly listCache = new Map<string, Observable<WorkArea[]>>();
  private readonly resourceCache = new Map<string, Observable<WorkArea>>();

  list(): Observable<WorkArea[]> {
    const url = this.companyService.buildInstallationApiUrl('work-areas');
    const cached = this.listCache.get(url);

    if (cached) {
      return cached;
    }

    const request = this.http
      .get<WorkArea[]>(url)
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    this.listCache.set(url, request);

    return request;
  }

  get(workAreaId: string): Observable<WorkArea> {
    const url = this.companyService.buildInstallationResourceUrl('work-areas', workAreaId);
    const cached = this.resourceCache.get(url);

    if (cached) {
      return cached;
    }

    const request = this.http.get<WorkArea>(url).pipe(shareReplay({ bufferSize: 1, refCount: false }));
    this.resourceCache.set(url, request);

    return request;
  }

  create(payload: WorkAreaUpsertPayload): Observable<WorkArea> {
    const collectionUrl = this.companyService.buildInstallationApiUrl('work-areas');

    return this.http
      .post<WorkArea>(collectionUrl, payload)
      .pipe(tap(() => this.invalidateCollection(collectionUrl)));
  }

  update(workAreaId: string, payload: WorkAreaUpsertPayload): Observable<WorkArea> {
    const collectionUrl = this.companyService.buildInstallationApiUrl('work-areas');
    const resourceUrl = this.companyService.buildInstallationResourceUrl('work-areas', workAreaId);

    return this.http
      .put<WorkArea>(resourceUrl, payload)
      .pipe(tap(() => this.invalidateCollection(collectionUrl)));
  }

  delete(workAreaId: string): Observable<void> {
    const collectionUrl = this.companyService.buildInstallationApiUrl('work-areas');
    const resourceUrl = this.companyService.buildInstallationResourceUrl('work-areas', workAreaId);

    return this.http
      .delete<void>(resourceUrl)
      .pipe(tap(() => this.invalidateCollection(collectionUrl)));
  }

  private invalidateCollection(collectionUrl: string): void {
    this.listCache.delete(collectionUrl);

    for (const resourceUrl of this.resourceCache.keys()) {
      if (resourceUrl.startsWith(collectionUrl)) {
        this.resourceCache.delete(resourceUrl);
      }
    }
  }
}
