import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BrnDialogRef, injectBrnDialogContext } from '@spartan-ng/brain/dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmComboboxImports } from '@spartan-ng/helm/combobox';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { firstValueFrom } from 'rxjs';
import { Employee } from '../employees/employees.model';
import { JobRole } from '../job-roles/job-roles.model';
import { WorkArea } from '../zones/zones.model';
import { localScheduleDatetimes, timeFromDateTime } from './schedule-entry-time';
import { ScheduleEntriesService } from './schedule-entries.service';
import { ScheduleEntry, ScheduleEntryUpsertPayload, ShiftTemplate } from './schedule-entry.model';

export interface ScheduleEntryDialogContext {
  entry?: ScheduleEntry;
  employeeId: string;
  date: string;
  employees: Employee[];
  jobRoles: JobRole[];
  workAreas: WorkArea[];
  shiftTemplates: ShiftTemplate[];
  onSaved: (entry: ScheduleEntry) => void;
  onDeleted: (entryId: string) => void;
}

@Component({
  selector: 'app-schedule-entry-dialog',
  imports: [NgTemplateOutlet, ReactiveFormsModule, HlmButtonImports, HlmComboboxImports, HlmDialogImports, HlmFieldImports, HlmInputImports, HlmTextareaImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './schedule-entry-dialog.component.html',
})
export class ScheduleEntryDialogComponent {
  protected readonly context = injectBrnDialogContext<ScheduleEntryDialogContext>();
  private readonly dialogRef = inject(BrnDialogRef);
  private readonly scheduleEntries = inject(ScheduleEntriesService);
  protected readonly entry = this.context.entry;
  protected readonly employees = this.context.employees.filter((employee) => employee.active);
  protected readonly workAreas = this.context.workAreas.filter(
    (workArea) => workArea.active || workArea.id === this.entry?.work_area,
  );
  private readonly selectedEmployeeId = signal(this.context.employeeId);
  protected readonly selectedEmployee = computed(() =>
    this.employees.find((employee) => employee.id === this.selectedEmployeeId()),
  );
  protected readonly allowedJobRoles = computed(() => {
    const roleIds = new Set(this.selectedEmployee()?.job_roles.map((role) => role.job_role) ?? []);
    return this.context.jobRoles.filter((role) => roleIds.has(role.id));
  });
  protected readonly selectedJobRole = computed(() =>
    this.allowedJobRoles().find((role) => role.id === this.form.controls.jobRole.value) ?? null,
  );
  protected readonly errorMessage = new FormControl<string | null>(null);
  protected readonly saving = new FormControl(false, { nonNullable: true });
  protected readonly deleting = new FormControl(false, { nonNullable: true });
  protected readonly timeSuggestionTarget = signal<'startsAt' | 'endsAt' | null>(null);
  protected readonly timeSuggestions = this.context.shiftTemplates.filter((template) => template.active !== false);
  protected readonly form = new FormGroup({
    employee: new FormControl(this.context.employeeId, { nonNullable: true, validators: Validators.required }),
    jobRole: new FormControl(this.entry?.job_role ?? this.defaultJobRole(this.context.employeeId), {
      nonNullable: true,
      validators: Validators.required,
    }),
    workArea: new FormControl(this.entry?.work_area ?? '', { nonNullable: true }),
    startsAt: new FormControl(this.entry ? timeFromDateTime(this.entry.starts_at) : '09:00', {
      nonNullable: true,
      validators: Validators.required,
    }),
    endsAt: new FormControl(this.entry ? timeFromDateTime(this.entry.ends_at) : '17:00', {
      nonNullable: true,
      validators: Validators.required,
    }),
    notes: new FormControl(this.entry?.notes ?? '', { nonNullable: true }),
  });

  constructor() {
    this.form.controls.employee.valueChanges.subscribe((employeeId) => {
      this.selectedEmployeeId.set(employeeId);
      const roles = this.rolesForEmployee(employeeId);
      if (!roles.some((role) => role.id === this.form.controls.jobRole.value)) {
        this.form.controls.jobRole.setValue(roles[0]?.id ?? '');
      }
    });
  }

  protected showTimeSuggestions(control: 'startsAt' | 'endsAt'): void {
    this.timeSuggestionTarget.set(control);
  }

  protected hideTimeSuggestions(): void {
    this.timeSuggestionTarget.set(null);
  }

  protected applyTimeSuggestion(template: ShiftTemplate): void {
    this.form.controls.startsAt.setValue(template.start_time.slice(0, 5));
    this.form.controls.endsAt.setValue(template.end_time.slice(0, 5));
    this.hideTimeSuggestions();
  }

  protected employeeToString(employee: Employee | null | undefined): string {
    return employee ? `${employee.first_name} ${employee.last_name}`.trim() : '';
  }

  protected jobRoleToString(jobRole: JobRole | null | undefined): string {
    return jobRole?.name ?? '';
  }

  protected selectEmployee(employee: Employee | null | undefined): void {
    if (employee) this.form.controls.employee.setValue(employee.id);
  }

  protected selectJobRole(jobRole: JobRole | null | undefined): void {
    if (jobRole) this.form.controls.jobRole.setValue(jobRole.id);
  }

  protected async save(): Promise<void> {
    if (this.form.invalid || this.saving.value) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.setValue(null);
    this.saving.setValue(true);
    const value = this.form.getRawValue();
    const datetimes = localScheduleDatetimes(this.context.date, value.startsAt, value.endsAt);
    const payload: ScheduleEntryUpsertPayload = {
      employee: value.employee,
      date: this.context.date,
      starts_at: datetimes.startsAt,
      ends_at: datetimes.endsAt,
      job_role: value.jobRole,
      notes: value.notes.trim(),
      work_area: value.workArea || null,
    };

    try {
      const saved = await firstValueFrom(
        this.entry
          ? this.scheduleEntries.update(this.entry.id, payload)
          : this.scheduleEntries.create(payload),
      );
      this.context.onSaved(saved);
      this.dialogRef.close();
    } catch (error: unknown) {
      this.errorMessage.setValue(apiErrorMessage(error));
    } finally {
      this.saving.setValue(false);
    }
  }

  protected async delete(): Promise<void> {
    if (!this.entry || this.deleting.value) return;
    this.errorMessage.setValue(null);
    this.deleting.setValue(true);
    try {
      await firstValueFrom(this.scheduleEntries.delete(this.entry.id));
      this.context.onDeleted(this.entry.id);
      this.dialogRef.close();
    } catch (error: unknown) {
      this.errorMessage.setValue(apiErrorMessage(error));
    } finally {
      this.deleting.setValue(false);
    }
  }

  private defaultJobRole(employeeId: string): string {
    const employee = this.context.employees.find((item) => item.id === employeeId);
    return employee?.job_roles.find((role) => role.primary)?.job_role ?? employee?.job_roles[0]?.job_role ?? '';
  }

  private rolesForEmployee(employeeId: string): JobRole[] {
    const roleIds = new Set(
      this.context.employees.find((employee) => employee.id === employeeId)?.job_roles.map((role) => role.job_role) ?? [],
    );
    return this.context.jobRoles.filter((role) => roleIds.has(role.id));
  }
}

function apiErrorMessage(error: unknown): string {
  if (!isErrorResponse(error)) return 'Could not save this schedule entry. Please try again.';
  const message = error.error;
  if (typeof message === 'string') return message;
  if (message && typeof message === 'object') {
    return Object.values(message).flatMap((value) => Array.isArray(value) ? value : [value]).filter((value): value is string => typeof value === 'string').join(' ') || 'Could not save this schedule entry.';
  }
  return 'Could not save this schedule entry. Please try again.';
}

function isErrorResponse(value: unknown): value is { error: unknown } {
  return typeof value === 'object' && value !== null && 'error' in value;
}
