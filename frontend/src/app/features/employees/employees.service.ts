import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { CompanyService } from '../../core/company/company.service';
import { Employee, EmployeeUpsertPayload } from './employees.model';

@Injectable({
  providedIn: 'root',
})
export class EmployeesService {
  private readonly http = inject(HttpClient);
  private readonly companyService = inject(CompanyService);
  private readonly listCache = new Map<string, Observable<Employee[]>>();
  private readonly resourceCache = new Map<string, Observable<Employee>>();

  list(): Observable<Employee[]> {
    const url = this.companyService.buildInstallationApiUrl('employees');
    const cached = this.listCache.get(url);

    if (cached) {
      return cached;
    }

    const request = this.http
      .get<Employee[]>(url)
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    this.listCache.set(url, request);

    return request;
  }

  get(employeeId: string): Observable<Employee> {
    const url = this.companyService.buildInstallationResourceUrl('employees', employeeId);
    const cached = this.resourceCache.get(url);

    if (cached) {
      return cached;
    }

    const request = this.http
      .get<Employee>(url)
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    this.resourceCache.set(url, request);

    return request;
  }

  create(payload: EmployeeUpsertPayload): Observable<Employee> {
    const collectionUrl = this.companyService.buildInstallationApiUrl('employees');

    return this.http
      .post<Employee>(collectionUrl, this.toEmployeePayload(payload))
      .pipe(tap(() => this.invalidateCollection(collectionUrl)));
  }

  update(employeeId: string, payload: EmployeeUpsertPayload): Observable<Employee> {
    const collectionUrl = this.companyService.buildInstallationApiUrl('employees');
    const resourceUrl = this.companyService.buildInstallationResourceUrl('employees', employeeId);

    return this.http
      .put<Employee>(resourceUrl, this.toEmployeePayload(payload))
      .pipe(tap(() => this.invalidateCollection(collectionUrl)));
  }

  delete(employeeId: string): Observable<void> {
    const collectionUrl = this.companyService.buildInstallationApiUrl('employees');
    const resourceUrl = this.companyService.buildInstallationResourceUrl('employees', employeeId);

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

  private toEmployeePayload(payload: EmployeeUpsertPayload) {
    const [firstName, lastName] = this.splitName(payload.full_name);

    return {
      first_name: firstName,
      last_name: lastName,
      email: payload.email,
      phone: payload.phone,
      color: payload.color,
      active: payload.active,
      job_roles: payload.job_roles,
    };
  }

  private splitName(name: string): [string, string] {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const firstName = parts.shift() ?? '';
    const lastName = parts.join(' ');

    return [firstName, lastName];
  }
}
