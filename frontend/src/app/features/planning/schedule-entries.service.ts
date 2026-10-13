import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CompanyService } from '../../core/company/company.service';
import { ScheduleEntry, ScheduleEntryUpsertPayload } from './schedule-entry.model';

@Injectable({ providedIn: 'root' })
export class ScheduleEntriesService {
  private readonly http = inject(HttpClient);
  private readonly companyService = inject(CompanyService);

  list(): Observable<ScheduleEntry[]> {
    return this.http.get<ScheduleEntry[]>(this.collectionUrl());
  }

  create(payload: ScheduleEntryUpsertPayload): Observable<ScheduleEntry> {
    return this.http.post<ScheduleEntry>(this.collectionUrl(), payload);
  }

  update(id: string, payload: ScheduleEntryUpsertPayload): Observable<ScheduleEntry> {
    return this.http.put<ScheduleEntry>(this.resourceUrl(id), payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(this.resourceUrl(id));
  }

  private collectionUrl(): string {
    return this.companyService.buildInstallationApiUrl('schedule-entries');
  }

  private resourceUrl(id: string): string {
    return this.companyService.buildInstallationResourceUrl('schedule-entries', id);
  }
}
