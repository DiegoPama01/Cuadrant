import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CompanyService } from '../../core/company/company.service';
import { StaffRequirement } from './planning.model';

@Injectable({ providedIn: 'root' })
export class PlanningRulesService {
  private readonly http = inject(HttpClient);
  private readonly company = inject(CompanyService);

  listRequirements(): Observable<StaffRequirement[]> { return this.http.get<StaffRequirement[]>(this.company.buildCompanyApiUrl('staff-requirements')); }
  createRequirement(payload: Omit<StaffRequirement, 'id'>): Observable<StaffRequirement> { return this.http.post<StaffRequirement>(this.company.buildCompanyApiUrl('staff-requirements'), payload); }
  deleteRequirement(id: string): Observable<void> { return this.http.delete<void>(this.company.buildCompanyResourceUrl('staff-requirements', id)); }
}
