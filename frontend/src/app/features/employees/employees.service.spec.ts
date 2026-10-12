import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { CompanyService } from '../../core/company/company.service';
import { EmployeesService } from './employees.service';

describe('EmployeesService', () => {
  let employeesService: EmployeesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: CompanyService,
          useValue: {
            buildInstallationApiUrl: (path: string) => `/api/companies/company-1/installations/installation-1/${path}/`,
            buildInstallationResourceUrl: (path: string, id: string) =>
              `/api/companies/company-1/installations/installation-1/${path}/${id}/`,
          },
        },
      ],
    });

    employeesService = TestBed.inject(EmployeesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses installation-scoped endpoints and the new employee payload', async () => {
    const requestPromise = firstValueFrom(employeesService.create({
      full_name: 'María López',
      email: 'maria@example.com',
      phone: '+34 600 000 000',
      color: '#64748b',
      active: true,
      job_roles: [{ job_role: 'job-role-1', primary: true, proficiency: null }],
    }));
    const request = http.expectOne('/api/companies/company-1/installations/installation-1/employees/');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      first_name: 'María',
      last_name: 'López',
      email: 'maria@example.com',
      phone: '+34 600 000 000',
      color: '#64748b',
      active: true,
      job_roles: [{ job_role: 'job-role-1', primary: true, proficiency: null }],
    });
    expect(request.request.body).not.toHaveProperty('position');
    expect(request.request.body).not.toHaveProperty('employee_positions');
    expect(request.request.body).not.toHaveProperty('allowed_zones');

    request.flush({ id: 'employee-1' });

    await expect(requestPromise).resolves.toEqual({ id: 'employee-1' });
  });
});
