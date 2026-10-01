import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CompanyService } from '../../core/company/company.service';
import type {
  Assignment,
  Contract,
  EmployeeAvailability,
  EmployeeAvailabilityException,
  EmployeePosition,
  EmployeeTimeOff,
  EmployeeZone,
  Planning,
  PlanningWeekResponse,
  PlanningWeekWritePayload,
  StaffRequirement,
  TimeBalanceEntry,
} from './planning.model';

@Injectable({
  providedIn: 'root',
})
export class PlanningService {
  private readonly http = inject(HttpClient);
  private readonly companyService = inject(CompanyService);

  getWeek(weekStart: string): Observable<PlanningWeekResponse> {
    return this.http.get<PlanningWeekResponse>(
      this.companyService.buildCompanyApiUrl(`planning-weeks/${weekStart}`),
    );
  }

  saveWeek(weekStart: string, payload: PlanningWeekWritePayload): Observable<PlanningWeekResponse> {
    return this.http.put<PlanningWeekResponse>(
      this.companyService.buildCompanyApiUrl(`planning-weeks/${weekStart}`),
      payload,
    );
  }

  listPlannings(): Observable<Planning[]> {
    return this.listResource<Planning>('plannings');
  }

  listContracts(): Observable<Contract[]> {
    return this.listResource<Contract>('contracts');
  }

  listEmployeePositions(): Observable<EmployeePosition[]> {
    return this.listResource<EmployeePosition>('employee-positions');
  }

  listEmployeeZones(): Observable<EmployeeZone[]> {
    return this.listResource<EmployeeZone>('employee-zones');
  }

  listEmployeeAvailabilities(): Observable<EmployeeAvailability[]> {
    return this.listResource<EmployeeAvailability>('employee-availabilities');
  }

  listEmployeeAvailabilityExceptions(): Observable<EmployeeAvailabilityException[]> {
    return this.listResource<EmployeeAvailabilityException>('employee-availability-exceptions');
  }

  listEmployeeTimeOffs(): Observable<EmployeeTimeOff[]> {
    return this.listResource<EmployeeTimeOff>('employee-time-offs');
  }

  listTimeBalanceEntries(): Observable<TimeBalanceEntry[]> {
    return this.listResource<TimeBalanceEntry>('time-balance-entries');
  }

  listAssignments(): Observable<Assignment[]> {
    return this.listResource<Assignment>('assignments');
  }

  listStaffRequirements(): Observable<StaffRequirement[]> {
    return this.listResource<StaffRequirement>('staff-requirements');
  }

  private listResource<T>(resourcePath: string): Observable<T[]> {
    return this.http.get<T[]>(this.companyService.buildCompanyApiUrl(resourcePath));
  }
}
