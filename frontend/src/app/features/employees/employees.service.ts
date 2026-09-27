import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';
import { CompanyService } from '../../core/company/company.service';
import type { Contract, EmployeeAvailability, EmployeePosition, EmployeeZone } from '../planning/planning.model';
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
    const url = this.companyService.buildCompanyApiUrl('employees');
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
    const url = this.companyService.buildCompanyResourceUrl('employees', employeeId);
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
    const collectionUrl = this.companyService.buildCompanyApiUrl('employees');
    const employeePayload = this.toEmployeePayload(payload);

    return this.http
      .post<Employee>(collectionUrl, employeePayload)
      .pipe(
        tap(() => this.invalidateCollection(collectionUrl)),
      );
  }

  update(employeeId: string, payload: EmployeeUpsertPayload): Observable<Employee> {
    const collectionUrl = this.companyService.buildCompanyApiUrl('employees');
    const resourceUrl = this.companyService.buildCompanyResourceUrl('employees', employeeId);
    const employeePayload = this.toEmployeePayload(payload);

    return this.http
      .put<Employee>(resourceUrl, employeePayload)
      .pipe(
        tap(() => this.invalidateCollection(collectionUrl)),
      );
  }

  listContracts(): Observable<Contract[]> {
    return this.http.get<Contract[]>(this.companyService.buildCompanyApiUrl('contracts'));
  }

  listEmployeePositions(): Observable<EmployeePosition[]> {
    return this.http.get<EmployeePosition[]>(this.companyService.buildCompanyApiUrl('employee-positions'));
  }

  listEmployeeZones(): Observable<EmployeeZone[]> {
    return this.http.get<EmployeeZone[]>(this.companyService.buildCompanyApiUrl('employee-zones'));
  }

  listAvailabilities(): Observable<EmployeeAvailability[]> {
    return this.http.get<EmployeeAvailability[]>(this.companyService.buildCompanyApiUrl('employee-availabilities'));
  }

  delete(employeeId: string): Observable<void> {
    const collectionUrl = this.companyService.buildCompanyApiUrl('employees');
    const resourceUrl = this.companyService.buildCompanyResourceUrl('employees', employeeId);

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
    const [firstName, lastName] = this.splitName(payload.full_name || `${payload.first_name} ${payload.last_name}`.trim());
    const contract = payload.contract.start_date
      ? {
        id: payload.contract.id,
        start_date: payload.contract.start_date,
        end_date: payload.contract.end_date || null,
        weekly_hours: payload.contract.weekly_hours,
        active: payload.contract.active,
      }
      : null;

    return {
      installation: payload.installation,
      employee_code: payload.employee_code,
      first_name: firstName,
      last_name: lastName,
      email: payload.email,
      phone: payload.phone,
      hire_date: payload.contract.start_date || payload.hire_date,
      termination_date: payload.contract.end_date || payload.termination_date || null,
      color: payload.color,
      notes: payload.notes,
      active: payload.active,
      all_zones: payload.zone_mode === 'all',
      availability_unrestricted: payload.availability_mode === 'unrestricted',
      position: payload.employee_positions.find((item) => item.primary)?.position || payload.employee_positions[0]?.position || payload.position || null,
      allowed_zones: payload.zone_mode === 'custom' ? payload.employee_zones.map((item) => item.zone) : [],
      contract,
      employee_positions: payload.employee_positions,
      employee_zones: payload.zone_mode === 'custom' ? payload.employee_zones : [],
      availabilities: payload.availability_mode === 'custom'
        ? payload.availabilities.map((availability) => ({
          ...availability,
          start_time: availability.available && availability.start_time ? availability.start_time : null,
          end_time: availability.available && availability.end_time ? availability.end_time : null,
        }))
        : [],
      grant_quadrant_access: payload.grant_quadrant_access,
    };
  }

  private splitName(name: string): [string, string] {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const firstName = parts.shift() ?? '';
    const lastName = parts.length > 0 ? parts.join(' ') : '';

    return [firstName, lastName];
  }
}
