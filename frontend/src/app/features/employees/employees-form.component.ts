import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { randomFormColor } from '../../shared/color-utils';
import { SelectionTableComponent } from '../../shared/selection-table/selection-table.component';
import { SelectionTableItem } from '../../shared/selection-table/selection-table.model';
import { JobRole } from '../job-roles/job-roles.model';
import { EmployeeJobRolePayload, EmployeeUpsertPayload } from './employees.model';

@Component({
  selector: 'app-employees-form',
  imports: [
    FormRoot,
    FormField,
    HlmButtonImports,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmSelectImports,
    HlmSwitchImports,
    SelectionTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employees-form.component.html',
})
export class EmployeesFormComponent {
  private readonly router = inject(Router);

  readonly initialValue = input.required<EmployeeUpsertPayload>();
  readonly jobRoles = input<JobRole[]>([]);
  readonly submitLabel = input('Guardar empleado');
  readonly formError = input<string | null>(null);
  readonly submitForm = input.required<(value: EmployeeUpsertPayload) => Promise<void>>();
  readonly cancelLink = input.required<string>();

  protected readonly model = signal<EmployeeUpsertPayload>(this.createEmptyModel());
  protected readonly jobRoleError = signal<string | null>(null);
  protected readonly selectedJobRoleIds = computed(() => this.model().job_roles.map((item) => item.job_role));
  protected readonly jobRoleOptions = computed<SelectionTableItem[]>(() =>
    this.jobRoles()
      .filter((jobRole) => jobRole.active !== false)
      .map((jobRole) => ({ id: jobRole.id, label: jobRole.name, detail: jobRole.code ?? undefined })),
  );
  protected readonly primaryJobRoleId = computed(
    () => this.model().job_roles.find((jobRole) => jobRole.primary)?.job_role ?? null,
  );
  protected readonly jobRoleIdToLabel = (jobRoleId: string | null): string =>
    jobRoleId ? this.jobRoleName(jobRoleId) : '';

  constructor() {
    effect(() => {
      this.model.set(this.normalizedInitialValue(this.initialValue()));
    });
  }

  protected readonly employeeForm = form(
    this.model,
    (schema) => {
      required(schema.full_name, { message: 'El nombre es obligatorio.' });
    },
    {
      submission: {
        action: async () => {
          const value = this.model();

          if (value.job_roles.length === 0) {
            this.jobRoleError.set('Selecciona al menos un puesto.');
            return;
          }

          this.jobRoleError.set(null);
          await this.submitForm()(value);
        },
      },
    },
  );

  protected async cancel(): Promise<void> {
    await this.router.navigateByUrl(this.cancelLink());
  }

  protected updateActive(active: boolean): void {
    this.model.update((value) => ({ ...value, active }));
  }

  protected addJobRole(item: SelectionTableItem): void {
    this.jobRoleError.set(null);
    this.model.update((value) => {
      if (value.job_roles.some((jobRole) => jobRole.job_role === item.id)) {
        return value;
      }

      const primary = value.job_roles.length === 0;
      return {
        ...value,
        job_roles: [...value.job_roles, { job_role: item.id, primary, proficiency: null }],
      };
    });
  }

  protected removeJobRole(item: SelectionTableItem): void {
    this.model.update((value) => {
      const remaining = value.job_roles.filter((jobRole) => jobRole.job_role !== item.id);
      const normalized = this.ensurePrimaryJobRole(remaining);
      this.jobRoleError.set(normalized.length === 0 ? 'Selecciona al menos un puesto.' : null);

      return { ...value, job_roles: normalized };
    });
  }

  protected setPrimaryJobRole(jobRoleId: string): void {
    this.model.update((value) => ({
      ...value,
      job_roles: value.job_roles.map((jobRole) => ({
        ...jobRole,
        primary: jobRole.job_role === jobRoleId,
      })),
    }));
  }

  protected jobRoleName(jobRoleId: string): string {
    return this.jobRoles().find((jobRole) => jobRole.id === jobRoleId)?.name ?? 'Puesto';
  }

  private normalizedInitialValue(value: EmployeeUpsertPayload): EmployeeUpsertPayload {
    return {
      ...this.createEmptyModel(),
      ...value,
      job_roles: this.ensurePrimaryJobRole(value.job_roles ?? []),
    };
  }

  private ensurePrimaryJobRole(jobRoles: EmployeeJobRolePayload[]): EmployeeJobRolePayload[] {
    if (jobRoles.length === 0) {
      return [];
    }

    const primaryJobRoleId = jobRoles.find((jobRole) => jobRole.primary)?.job_role ?? jobRoles[0].job_role;

    return jobRoles.map((jobRole) => ({
      ...jobRole,
      primary: jobRole.job_role === primaryJobRoleId,
      proficiency: jobRole.proficiency ?? null,
    }));
  }

  private createEmptyModel(): EmployeeUpsertPayload {
    return {
      full_name: '',
      email: '',
      phone: '',
      color: randomFormColor(),
      active: true,
      job_roles: [],
    };
  }
}
