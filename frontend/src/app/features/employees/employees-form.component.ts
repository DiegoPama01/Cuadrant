import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { HlmDatePickerImports } from '@spartan-ng/helm/date-picker';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmRadioGroupImports } from '@spartan-ng/helm/radio-group';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { SelectionTableComponent } from '../../shared/selection-table/selection-table.component';
import { SelectionTableItem } from '../../shared/selection-table/selection-table.model';
import { randomFormColor } from '../../shared/color-utils';
import { Position } from '../positions/positions.model';
import { Zone } from '../zones/zones.model';
import { EmployeeAvailabilityFormPayload, EmployeeUpsertPayload, EmployeeZoneMode } from './employees.model';

const WEEK_DAYS = [
  { value: 0, label: 'Lunes' },
  { value: 1, label: 'Martes' },
  { value: 2, label: 'Miércoles' },
  { value: 3, label: 'Jueves' },
  { value: 4, label: 'Viernes' },
  { value: 5, label: 'Sábado' },
  { value: 6, label: 'Domingo' },
] as const;

@Component({
  selector: 'app-employees-form',
  imports: [
    FormRoot,
    FormField,
    HlmButtonImports,
    HlmCardImports,
    HlmCheckboxImports,
    HlmDatePickerImports,
    HlmFieldImports,
    HlmInputImports,
    HlmRadioGroupImports,
    HlmSelectImports,
    HlmSwitchImports,
    HlmTableImports,
    SelectionTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employees-form.component.html',
})
export class EmployeesFormComponent {
  private readonly router = inject(Router);

  readonly initialValue = input.required<EmployeeUpsertPayload>();
  readonly positions = input<Position[]>([]);
  readonly zones = input<Zone[]>([]);
  readonly submitLabel = input('Guardar empleado');
  readonly formError = input<string | null>(null);
  readonly submitForm = input.required<(value: EmployeeUpsertPayload) => Promise<void>>();
  readonly cancelLink = input.required<string>();

  protected readonly days = WEEK_DAYS;
  protected readonly model = signal<EmployeeUpsertPayload>(this.createEmptyModel());
  protected readonly startDateValue = computed(() => this.parseDateValue(this.model().contract.start_date));
  protected readonly endDateValue = computed(() => this.parseDateValue(this.model().contract.end_date));
  protected readonly formatDateForDisplay = (date: Date): string => this.formatDateValue(date);
  protected readonly formatDateForInput = (date: Date): string => this.formatDateValue(date);
  protected readonly parseDateInput = (value: string): Date | null => this.parseDateValue(value) ?? null;
  protected readonly positionIdToLabel = (positionId: string | null): string => positionId ? this.positionName(positionId) : '';

  protected readonly filteredPositions = computed(() => this.filterByInstallation(this.positions()));
  protected readonly filteredZones = computed(() => this.filterByInstallation(this.zones()));
  protected readonly selectedPositionIds = computed(() => this.model().employee_positions.map((item) => item.position));
  protected readonly selectedZoneIds = computed(() => this.model().employee_zones.map((item) => item.zone));
  protected readonly positionOptions = computed<SelectionTableItem[]>(() =>
    this.filteredPositions().map((position) => ({ id: position.id, label: position.name, detail: position.code ?? undefined })),
  );
  protected readonly zoneOptions = computed<SelectionTableItem[]>(() =>
    this.filteredZones().map((zone) => ({ id: zone.id, label: zone.name, detail: zone.code ?? undefined })),
  );

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
          await this.submitForm()({ ...this.model() });
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

  protected updateQuadrantAccess(grantQuadrantAccess: boolean): void {
    this.model.update((value) => ({ ...value, grant_quadrant_access: grantQuadrantAccess }));
  }

  protected updateDateField(field: 'start_date' | 'end_date', date: Date | null): void {
    this.model.update((value) => ({
      ...value,
      contract: { ...value.contract, [field]: date ? this.formatDateValue(date) : '' },
    }));
  }

  protected addPosition(item: SelectionTableItem): void {
    this.model.update((value) => {
      if (value.employee_positions.some((position) => position.position === item.id)) {
        return value;
      }

      const isPrimary = value.employee_positions.length === 0;
      return {
        ...value,
        position: isPrimary ? item.id : value.position,
        employee_positions: [...value.employee_positions, { position: item.id, primary: isPrimary }],
      };
    });
  }

  protected removePosition(item: SelectionTableItem): void {
    this.model.update((value) => {
      const remaining = value.employee_positions.filter((position) => position.position !== item.id);
      const hasPrimary = remaining.some((position) => position.primary);
      const normalized = hasPrimary || remaining.length === 0
        ? remaining
        : remaining.map((position, index) => ({ ...position, primary: index === 0 }));
      const primary = normalized.find((position) => position.primary)?.position ?? normalized[0]?.position ?? '';

      return { ...value, position: primary, employee_positions: normalized };
    });
  }

  protected setPrimaryPosition(positionId: string): void {
    this.model.update((value) => ({
      ...value,
      position: positionId,
      employee_positions: value.employee_positions.map((position) => ({
        ...position,
        primary: position.position === positionId,
      })),
    }));
  }

  protected setZoneMode(zoneMode: EmployeeZoneMode): void {
    this.model.update((value) => ({ ...value, zone_mode: zoneMode }));
  }

  protected addZone(item: SelectionTableItem): void {
    this.model.update((value) => value.employee_zones.some((zone) => zone.zone === item.id)
      ? value
      : { ...value, employee_zones: [...value.employee_zones, { zone: item.id, preferred: false }] });
  }

  protected removeZone(item: SelectionTableItem): void {
    this.model.update((value) => ({
      ...value,
      employee_zones: value.employee_zones.filter((zone) => zone.zone !== item.id),
    }));
  }

  protected updateAvailabilityMode(mode: 'unrestricted' | 'custom'): void {
    this.model.update((value) => ({ ...value, availability_mode: mode }));
  }

  protected updateAvailabilityDay(dayOfWeek: number, changes: Partial<EmployeeAvailabilityFormPayload>): void {
    this.model.update((value) => ({
      ...value,
      availabilities: value.availabilities.map((availability) => availability.day_of_week === dayOfWeek
        ? { ...availability, ...changes }
        : availability),
    }));
  }

  protected positionName(positionId: string): string {
    return this.positions().find((position) => position.id === positionId)?.name ?? 'Puesto';
  }

  private normalizedInitialValue(value: EmployeeUpsertPayload): EmployeeUpsertPayload {
    const next = { ...this.createEmptyModel(), ...value,
      allowed_zones: Array.isArray(value.allowed_zones) ? value.allowed_zones : [],
      employee_positions: Array.isArray(value.employee_positions) ? value.employee_positions : [],
      employee_zones: Array.isArray(value.employee_zones) ? value.employee_zones : [],
      availabilities: Array.isArray(value.availabilities) ? value.availabilities : [],
    };
    const employeePositions = next.employee_positions.length > 0
      ? next.employee_positions
      : next.position
        ? [{ position: next.position, primary: true }]
        : [];
    const primary = employeePositions.find((position) => position.primary)?.position ?? employeePositions[0]?.position ?? '';

    return {
      ...next,
      full_name: next.full_name || `${next.first_name} ${next.last_name}`.trim(),
      position: primary,
      employee_positions: employeePositions.map((position) => ({ ...position, primary: position.position === primary })),
      contract: { ...this.createEmptyModel().contract, ...next.contract },
      availabilities: this.mergeAvailabilityRows(next.availabilities),
    };
  }

  private mergeAvailabilityRows(rows: EmployeeAvailabilityFormPayload[]): EmployeeAvailabilityFormPayload[] {
    const validRows = Array.isArray(rows) ? rows.filter((row) => row && Number.isInteger(row.day_of_week) && row.day_of_week >= 0 && row.day_of_week <= 6) : [];
    return WEEK_DAYS.map((day) => validRows.find((row) => row.day_of_week === day.value) ?? {
      day_of_week: day.value,
      available: day.value < 5,
      start_time: day.value < 5 ? '07:00' : '',
      end_time: day.value < 5 ? '18:00' : '',
    });
  }

  private createEmptyModel(): EmployeeUpsertPayload {
    return {
      employee_code: '',
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
      availabilities: this.mergeAvailabilityRows([]),
      grant_quadrant_access: false,
    };
  }

  private filterByInstallation<T extends { installation?: string | null }>(items: T[]): T[] {
    const installationId = this.model().installation;

    return installationId ? items.filter((item) => item.installation === installationId) : items;
  }

  private parseDateValue(value: string | null | undefined): Date | undefined {
    if (!value) return undefined;
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!match) return undefined;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);

    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
  }

  private formatDateValue(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
