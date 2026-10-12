import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { CompanyService } from '../../core/company/company.service';
import { JobRole, JobRoleUpsertPayload } from './job-roles.model';

@Injectable({
  providedIn: 'root',
})
export class JobRolesService {
  private readonly http = inject(HttpClient);
  private readonly companyService = inject(CompanyService);
  private readonly listCache = new Map<string, Observable<JobRole[]>>();
  private readonly resourceCache = new Map<string, Observable<JobRole>>();

  list(): Observable<JobRole[]> {
    const url = this.companyService.buildInstallationApiUrl('job-roles');
    const cached = this.listCache.get(url);

    if (cached) {
      return cached;
    }

    const request = this.http
      .get<JobRole[]>(url)
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    this.listCache.set(url, request);

    return request;
  }

  get(jobRoleId: string): Observable<JobRole> {
    const url = this.companyService.buildInstallationResourceUrl('job-roles', jobRoleId);
    const cached = this.resourceCache.get(url);
    if (cached) return cached;

    const request = this.http.get<JobRole>(url).pipe(shareReplay({ bufferSize: 1, refCount: false }));
    this.resourceCache.set(url, request);
    return request;
  }

  create(payload: JobRoleUpsertPayload): Observable<JobRole> {
    const url = this.companyService.buildInstallationApiUrl('job-roles');
    return this.http.post<JobRole>(url, payload).pipe(tap(() => this.invalidate(url)));
  }

  update(jobRoleId: string, payload: JobRoleUpsertPayload): Observable<JobRole> {
    const collectionUrl = this.companyService.buildInstallationApiUrl('job-roles');
    const url = this.companyService.buildInstallationResourceUrl('job-roles', jobRoleId);
    return this.http.put<JobRole>(url, payload).pipe(tap(() => this.invalidate(collectionUrl)));
  }

  delete(jobRoleId: string): Observable<void> {
    const collectionUrl = this.companyService.buildInstallationApiUrl('job-roles');
    const url = this.companyService.buildInstallationResourceUrl('job-roles', jobRoleId);
    return this.http.delete<void>(url).pipe(tap(() => this.invalidate(collectionUrl)));
  }

  private invalidate(collectionUrl: string): void {
    this.listCache.delete(collectionUrl);
    for (const resourceUrl of this.resourceCache.keys()) {
      if (resourceUrl.startsWith(collectionUrl)) this.resourceCache.delete(resourceUrl);
    }
  }
}
