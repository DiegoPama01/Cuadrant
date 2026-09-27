import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { PositionsService } from '../positions/positions.service';
import { ZonesService } from '../zones/zones.service';
import { EmployeesFormComponent } from './employees-form.component';
import { Employee, EmployeeUpsertPayload } from './employees.model';
import { EmployeesService } from './employees.service';
import { CompanyService } from '../../core/company/company.service';
import { randomFormColor } from '../../shared/color-utils';

@Component({
  selector: 'app-employees-form-page',
  imports: [EmployeesFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employees-form-page.component.html',
})
export class EmployeesFormPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly employeesService = inject(EmployeesService);
  private readonly companyService = inject(CompanyService);
  private readonly positionsService = inject(PositionsService);
  private readonly zonesService = inject(ZonesService);

  private readonly employeeId = this.route.snapshot.paramMap.get('id');
  protected readonly isEditMode = this.employeeId !== null;
  protected readonly formError = signal<string | null>(null);

  protected readonly employeeFormResource = resource({
    loader: async () =>
      firstValueFrom(
        forkJoin({
          employee: this.employeeId ? this.employeesService.get(this.employeeId) : of(null),
          employees: this.employeesService.list(),
          positions: this.positionsService.list(),
          zones: this.zonesService.list(),
          contracts: this.employeeId ? this.employeesService.listContracts() : of([]),
          employeePositions: this.employeeId ? this.employeesService.listEmployeePositions() : of([]),
          employeeZones: this.employeeId ? this.employeesService.listEmployeeZones() : of([]),
          availabilities: this.employeeId ? this.employeesService.listAvailabilities() : of([]),
        }),
      ),
  });

  protected readonly initialValue = computed<EmployeeUpsertPayload>(() => {
    const formData = this.employeeFormResource.value();
    const employee = formData?.employee;
    const installationId = this.companyService.getActiveInstallationId() ?? undefined;

    if (!employee) {
      return {
        installation: installationId,
        employee_code: this.createNextEmployeeCode(formData?.employees ?? [], installationId),
        full_name: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        hire_date: '',
        termination_date: '',
        color: randomFormColor(),
        notes: '',
        active: true,
        position: '',
        allowed_zones: [],
        contract: { weekly_hours: 40, start_date: '', end_date: '', active: true },
        employee_positions: [],
        zone_mode: 'all',
        employee_zones: [],
        availability_mode: 'unrestricted',
        availabilities: [],
        grant_quadrant_access: false,
      };
    }

    const employeeContracts = formData?.contracts.filter((contract) => contract.employee === employee.id) ?? [];
    const activeContract = employeeContracts.find((contract) => contract.active) ?? employeeContracts[0];
    const employeePositions = formData?.employeePositions.filter((position) => position.employee === employee.id) ?? [];
    const employeeZones = formData?.employeeZones.filter((zone) => zone.employee === employee.id) ?? [];
    const availabilities = formData?.availabilities.filter((availability) => availability.employee === employee.id) ?? [];

    return {
      installation: employee.installation ?? undefined,
      employee_code: employee.employee_code ?? '',
      full_name: `${employee.first_name} ${employee.last_name}`.trim(),
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email ?? '',
      phone: employee.phone ?? '',
      hire_date: employee.hire_date ?? '',
      termination_date: employee.termination_date ?? '',
      color: employee.color ?? randomFormColor(),
      notes: employee.notes ?? '',
      active: employee.active,
      position: employee.position ?? '',
      allowed_zones: Array.isArray(employee.allowed_zones) ? [...employee.allowed_zones] : [],
      contract: {
        id: activeContract?.id,
        weekly_hours: activeContract?.weekly_hours ?? 40,
        start_date: activeContract?.start_date ?? employee.hire_date ?? '',
        end_date: activeContract?.end_date ?? employee.termination_date ?? '',
        active: activeContract?.active ?? true,
      },
      employee_positions: employeePositions.map((position) => ({
        id: position.id,
        position: position.position,
        primary: position.primary ?? false,
      })),
      zone_mode: employeeZones.length > 0 || (Array.isArray(employee.allowed_zones) && employee.allowed_zones.length > 0) ? 'custom' : 'all',
      employee_zones: employeeZones.length > 0
        ? employeeZones.map((zone) => ({ id: zone.id, zone: zone.zone, preferred: zone.preferred ?? false }))
        : (Array.isArray(employee.allowed_zones) ? employee.allowed_zones : []).map((zone) => ({ zone, preferred: false })),
      availability_mode: availabilities.length > 0 ? 'custom' : 'unrestricted',
      availabilities: availabilities.map((availability) => ({
        id: availability.id,
        day_of_week: availability.day_of_week ?? availability.weekday ?? 0,
        available: availability.available ?? availability.status !== 'unavailable',
        start_time: availability.start_time?.slice(0, 5) ?? '',
        end_time: availability.end_time?.slice(0, 5) ?? '',
      })),
      grant_quadrant_access: employee.user !== null && employee.user !== undefined,
    };
  });

  protected readonly positions = computed(() => this.employeeFormResource.value()?.positions ?? []);
  protected readonly zones = computed(() => this.employeeFormResource.value()?.zones ?? []);

  protected async saveEmployee(payload: EmployeeUpsertPayload): Promise<void> {
    this.formError.set(null);
    const employeePayload = this.withGeneratedEmployeeCode(payload);

    try {
      if (this.employeeId) {
        await firstValueFrom(this.employeesService.update(this.employeeId, employeePayload));
      } else {
        await firstValueFrom(this.employeesService.create(employeePayload));
      }

      await this.router.navigate(['/employees']);
    } catch {
      this.formError.set('We could not save this employee. Please review the form and try again.');
    }
  }

  private withGeneratedEmployeeCode(payload: EmployeeUpsertPayload): EmployeeUpsertPayload {
    const employeeCode = payload.employee_code?.trim();

    return {
      ...payload,
      installation: payload.installation || this.companyService.getActiveInstallationId() || undefined,
      employee_code: employeeCode || this.createNextEmployeeCode(
        this.employeeFormResource.value()?.employees ?? [],
        payload.installation || this.companyService.getActiveInstallationId() || undefined,
      ),
    };
  }

  private createNextEmployeeCode(employees: Employee[], installationId?: string): string {
    const scopedEmployees = installationId
      ? employees.filter((employee) => employee.installation === installationId)
      : employees;
    const codes = (scopedEmployees.length > 0 ? scopedEmployees : employees)
      .map((employee) => employee.employee_code?.trim())
      .filter((code): code is string => !!code);
    const parsedCodes = codes
      .map((code) => /^(?<prefix>[A-Za-z]+[-_]?)(?<number>\d+)$/.exec(code))
      .filter((match): match is RegExpExecArray & { groups: { prefix: string; number: string } } => !!match?.groups)
      .map((match) => ({
        prefix: match.groups.prefix,
        number: Number(match.groups.number),
        width: match.groups.number.length,
      }))
      .filter((code) => Number.isFinite(code.number));

    if (parsedCodes.length === 0) {
      return 'E-001';
    }

    const latestCode = parsedCodes.reduce((max, code) => code.number > max.number ? code : max, parsedCodes[0]);
    const nextNumber = String(latestCode.number + 1).padStart(Math.max(latestCode.width, 3), '0');

    return `${latestCode.prefix}${nextNumber}`;
  }

}
