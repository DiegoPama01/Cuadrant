import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { JobRolesService } from '../job-roles/job-roles.service';
import { EmployeesFormComponent } from './employees-form.component';
import { EmployeeUpsertPayload } from './employees.model';
import { EmployeesService } from './employees.service';

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
  private readonly jobRolesService = inject(JobRolesService);

  private readonly employeeId = this.route.snapshot.paramMap.get('id');
  protected readonly isEditMode = this.employeeId !== null;
  protected readonly formError = signal<string | null>(null);

  protected readonly employeeFormResource = resource({
    loader: async () =>
      firstValueFrom(
        forkJoin({
          employee: this.employeeId ? this.employeesService.get(this.employeeId) : of(null),
          jobRoles: this.jobRolesService.list(),
        }),
      ),
  });

  protected readonly initialValue = computed<EmployeeUpsertPayload>(() => {
    const employee = this.employeeFormResource.value()?.employee;

    if (!employee) {
      return this.emptyValue();
    }

    return {
      full_name: `${employee.first_name} ${employee.last_name}`.trim(),
      email: employee.email ?? '',
      phone: employee.phone ?? '',
      color: employee.color ?? '#64748b',
      active: employee.active,
      job_roles: employee.job_roles.map((jobRole) => ({
        job_role: jobRole.job_role,
        primary: jobRole.primary,
        proficiency: jobRole.proficiency ?? null,
      })),
    };
  });
  protected readonly jobRoles = computed(() => this.employeeFormResource.value()?.jobRoles ?? []);
  protected readonly loadError = computed(() => {
    const error = this.employeeFormResource.error();

    return error ? 'No se pudo cargar el formulario de empleado. Inténtalo de nuevo.' : null;
  });

  protected reload(): void {
    void this.employeeFormResource.reload();
  }

  protected async saveEmployee(payload: EmployeeUpsertPayload): Promise<void> {
    this.formError.set(null);

    try {
      if (this.employeeId) {
        await firstValueFrom(this.employeesService.update(this.employeeId, payload));
      } else {
        await firstValueFrom(this.employeesService.create(payload));
      }

      await this.router.navigate(['/employees']);
    } catch {
      this.formError.set('No se pudo guardar el empleado. Revisa los datos e inténtalo de nuevo.');
    }
  }

  private emptyValue(): EmployeeUpsertPayload {
    return {
      full_name: '',
      email: '',
      phone: '',
      color: '#64748b',
      active: true,
      job_roles: [],
    };
  }
}
