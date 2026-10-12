import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { CompanyService } from '../core/company/company.service';
import { JobRolesService } from './job-roles/job-roles.service';
import { ShiftTemplatesService } from './planning/shift-templates.service';
import { WorkAreasService } from './zones/zones.service';

describe('installation catalog services', () => {
  let http: HttpTestingController;
  let workAreasService: WorkAreasService;
  let jobRolesService: JobRolesService;
  let shiftTemplatesService: ShiftTemplatesService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: CompanyService,
          useValue: {
            buildInstallationApiUrl: (path: string) =>
              `/api/companies/company-1/installations/installation-1/${path}/`,
            buildInstallationResourceUrl: (path: string, id: string) =>
              `/api/companies/company-1/installations/installation-1/${path}/${id}/`,
          },
        },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    workAreasService = TestBed.inject(WorkAreasService);
    jobRolesService = TestBed.inject(JobRolesService);
    shiftTemplatesService = TestBed.inject(ShiftTemplatesService);
  });

  afterEach(() => http.verify());

  it('creates work areas without legacy staffing requirements', async () => {
    const requestPromise = firstValueFrom(
      workAreasService.create({
        name: 'Front desk',
        code: 'FD',
        description: 'Reception desk',
        color: '#2563eb',
        active: true,
      }),
    );
    const request = http.expectOne('/api/companies/company-1/installations/installation-1/work-areas/');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).not.toHaveProperty('installation');
    expect(request.request.body).not.toHaveProperty('staff_requirements');
    request.flush({ id: 'work-area-1' });
    await expect(requestPromise).resolves.toEqual({ id: 'work-area-1' });
  });

  it('creates job roles through the installation-scoped job-roles endpoint', async () => {
    const requestPromise = firstValueFrom(
      jobRolesService.create({
        name: 'Receptionist',
        code: 'REC',
        description: 'Welcomes guests',
        color: '#16a34a',
        active: true,
      }),
    );
    const request = http.expectOne('/api/companies/company-1/installations/installation-1/job-roles/');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).not.toHaveProperty('installation');
    request.flush({ id: 'job-role-1' });
    await expect(requestPromise).resolves.toEqual({ id: 'job-role-1' });
  });

  it('creates shift templates through the installation-scoped shift-templates endpoint', async () => {
    const requestPromise = firstValueFrom(
      shiftTemplatesService.create({
        name: 'Morning',
        code: 'AM',
        description: 'Morning service',
        start_time: '08:00',
        end_time: '16:00',
        break_minutes: 30,
        color: '#f97316',
        active: true,
      }),
    );
    const request = http.expectOne('/api/companies/company-1/installations/installation-1/shift-templates/');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).not.toHaveProperty('installation');
    request.flush({ id: 'shift-template-1' });
    await expect(requestPromise).resolves.toEqual({ id: 'shift-template-1' });
  });
});
