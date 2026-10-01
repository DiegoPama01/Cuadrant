import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable } from 'rxjs';
import { CompanyService } from '../../core/company/company.service';
import { PlanningService } from './planning.service';
import { PlanningWeekResponse } from './planning.model';

describe('PlanningService', () => {
  let planningService: PlanningService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: CompanyService,
          useValue: { buildCompanyApiUrl: (path: string) => `/api/companies/company-1/${path}/` },
        },
      ],
    });

    planningService = TestBed.inject(PlanningService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests the selected planning week for the active company', async () => {
    const response: PlanningWeekResponse = { week_start: '2026-09-14', week_end: '2026-09-20', assignments: [] };
    const requestPromise = firstValueFrom(planningService.getWeek('2026-09-14'));
    const request = http.expectOne('/api/companies/company-1/planning-weeks/2026-09-14/');

    expect(request.request.method).toBe('GET');
    request.flush(response);

    await expect(requestPromise).resolves.toEqual(response);
  });

  it('saves assignments for the selected planning week', async () => {
    const payload = {
      assignments: [{ employee: 'employee-1', date: '2026-09-14', zone: 'zone-1', shift: 'shift-1', position: 'position-1', notes: 'Cover' }],
    };
    const response: PlanningWeekResponse = { week_start: '2026-09-14', week_end: '2026-09-20', assignments: [] };
    const requestPromise = firstValueFrom(planningService.saveWeek('2026-09-14', payload));
    const request = http.expectOne('/api/companies/company-1/planning-weeks/2026-09-14/');

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(payload);
    request.flush(response);

    await expect(requestPromise).resolves.toEqual(response);
  });

  it('exposes company-scoped planning entity collections', async () => {
    const collections: Array<{ request: Observable<unknown[]>; path: string }> = [
      { request: planningService.listPlannings(), path: 'plannings' },
      { request: planningService.listContracts(), path: 'contracts' },
      { request: planningService.listEmployeePositions(), path: 'employee-positions' },
      { request: planningService.listEmployeeZones(), path: 'employee-zones' },
      { request: planningService.listEmployeeAvailabilities(), path: 'employee-availabilities' },
      {
        request: planningService.listEmployeeAvailabilityExceptions(),
        path: 'employee-availability-exceptions',
      },
      { request: planningService.listEmployeeTimeOffs(), path: 'employee-time-offs' },
      { request: planningService.listTimeBalanceEntries(), path: 'time-balance-entries' },
      { request: planningService.listAssignments(), path: 'assignments' },
      { request: planningService.listStaffRequirements(), path: 'staff-requirements' },
    ];

    const promises = collections.map((collection) => firstValueFrom(collection.request));

    for (const collection of collections) {
      const request = http.expectOne(`/api/companies/company-1/${collection.path}/`);
      expect(request.request.method).toBe('GET');
      request.flush([]);
    }

    await expect(Promise.all(promises)).resolves.toEqual(collections.map(() => []));
  });
});
