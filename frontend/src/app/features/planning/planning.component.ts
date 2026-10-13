import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { firstValueFrom, forkJoin } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideChevronRight, lucideDownload, lucidePlus, lucideRefreshCw } from '@ng-icons/lucide';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmDatePickerImports } from '@spartan-ng/helm/date-picker';
import { HlmDialogService } from '@spartan-ng/helm/dialog';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmToggleGroupImports } from '@spartan-ng/helm/toggle-group';
import { Employee } from '../employees/employees.model';
import { EmployeesService } from '../employees/employees.service';
import { JobRolesService } from '../job-roles/job-roles.service';
import { localDate, localScheduleDatetimes, timeFromDateTime } from './schedule-entry-time';
import { ScheduleEntryDialogComponent } from './schedule-entry-dialog.component';
import { buildScheduleEntriesCsv } from './schedule-entry-export';
import { ScheduleEntriesService } from './schedule-entries.service';
import { ScheduleEntry } from './schedule-entry.model';
import { ShiftEntryComponent } from './shift-entry.component';
import { ShiftTemplatesService } from './shift-templates.service';
import { AlertService } from '../../core/alerts/alert.service';

interface PlanningDay {
  date: string;
  weekday: string;
  displayDate: string;
}

interface ScheduleCell {
  employeeId: string;
  date: string;
}

type PlanningDragData = Employee | ScheduleEntry;

@Component({
  selector: 'app-planning',
  imports: [
    NgIcon,
    HlmBadgeImports,
    HlmButtonImports,
    HlmCardImports,
    HlmDatePickerImports,
    HlmInputImports,
    HlmTableImports,
    HlmToggleGroupImports,
    CdkDrag,
    CdkDropList,
    ShiftEntryComponent,
  ],
  providers: [
    provideIcons({ lucideChevronLeft, lucideChevronRight, lucideDownload, lucidePlus, lucideRefreshCw }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './planning.component.html',
})
export class PlanningComponent {
  private readonly employeesService = inject(EmployeesService);
  private readonly jobRolesService = inject(JobRolesService);
  private readonly scheduleEntriesService = inject(ScheduleEntriesService);
  private readonly shiftTemplatesService = inject(ShiftTemplatesService);
  private readonly dialog = inject(HlmDialogService);
  private readonly alerts = inject(AlertService);
  private readonly document = inject(DOCUMENT);

  protected readonly selectedDate = signal(localDate(new Date()));
  protected readonly employeeSearch = signal('');
  private readonly localChanges = signal<ScheduleEntry[] | null>(null);
  private readonly movingEntryIds = signal<ReadonlySet<string>>(new Set());

  protected readonly catalogResource = resource({
    loader: async () =>
      firstValueFrom(
        forkJoin({
          employees: this.employeesService.list(),
          jobRoles: this.jobRolesService.list(),
          shiftTemplates: this.shiftTemplatesService.list(),
        }),
      ),
  });
  protected readonly entriesResource = resource({
    params: () => ({ weekStart: this.weekStartIso() }),
    loader: async () => firstValueFrom(this.scheduleEntriesService.list()),
  });

  protected readonly weekStart = computed(() => this.startOfWeek(new Date(`${this.selectedDate()}T12:00:00`)));
  protected readonly weekStartIso = computed(() => localDate(this.weekStart()));
  protected readonly weekRangeLabel = computed(() => {
    const start = this.weekStart();
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${this.formatDay(start)} – ${this.formatDay(end)}`;
  });
  protected readonly days = computed<PlanningDay[]>(() =>
    Array.from({ length: 7 }, (_, index) => {
      const date = new Date(this.weekStart());
      date.setDate(date.getDate() + index);
      return {
        date: localDate(date),
        weekday: date.toLocaleDateString('en-GB', { weekday: 'short' }),
        displayDate: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      };
    }),
  );
  protected readonly catalog = computed(() => this.catalogResource.value());
  protected readonly employees = computed(() => {
    const search = this.employeeSearch().trim().toLocaleLowerCase();
    return (this.catalog()?.employees ?? []).filter(
      (employee) =>
        employee.active &&
        `${employee.first_name} ${employee.last_name}`.toLocaleLowerCase().includes(search),
    );
  });
  protected readonly dropListIds = computed(() =>
    this.employees().flatMap((employee) =>
      this.days().map((day) => this.dropListId(employee.id, day.date)),
    ),
  );
  protected readonly entries = computed(() => {
    const allEntries = this.localChanges() ?? this.entriesResource.value() ?? [];
    const dates = new Set(this.days().map((day) => day.date));
    return allEntries.filter((entry) => dates.has(entry.date.slice(0, 10)));
  });
  protected readonly entriesByCell = computed(() => {
    const grouped = new Map<string, ScheduleEntry[]>();
    for (const entry of this.entries()) {
      const key = this.cellKey(entry.employee, entry.date);
      grouped.set(key, [...(grouped.get(key) ?? []), entry].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
    }
    return grouped;
  });
  protected readonly roleNames = computed(
    () => new Map((this.catalog()?.jobRoles ?? []).map((role) => [role.id, role.name])),
  );
  protected readonly roleColors = computed(
    () => new Map((this.catalog()?.jobRoles ?? []).map((role) => [role.id, role.color])),
  );
  private readonly employeeNames = computed(
    () =>
      new Map(
        (this.catalog()?.employees ?? []).map((employee) => [
          employee.id,
          `${employee.first_name} ${employee.last_name}`.trim(),
        ]),
      ),
  );

  protected previousWeek(): void {
    this.moveWeek(-7);
  }

  protected nextWeek(): void {
    this.moveWeek(7);
  }

  protected updateDate(date: Date | null | undefined): void {
    if (date) this.selectedDate.set(localDate(date));
  }

  protected reload(): void {
    this.localChanges.set(null);
    void this.catalogResource.reload();
    void this.entriesResource.reload();
  }

  protected entriesFor(employeeId: string, date: string): ScheduleEntry[] {
    return this.entriesByCell().get(this.cellKey(employeeId, date)) ?? [];
  }

  protected cell(employeeId: string, date: string): ScheduleCell {
    return { employeeId, date };
  }

  protected isEntryMoving(entryId: string): boolean {
    return this.movingEntryIds().has(entryId);
  }

  protected openCreate(employeeId: string, date: string): void {
    this.openDialog(employeeId, date);
  }

  protected handleDrop(event: CdkDragDrop<ScheduleCell, unknown, PlanningDragData>): void {
    event.item.reset();
    const destination = event.container.data;
    const dragged = event.item.data;

    if (isEmployee(dragged)) {
      this.openDialog(destination.employeeId, destination.date);
      return;
    }
    if (isScheduleEntry(dragged)) {
      void this.moveScheduleEntry(dragged, destination);
    }
  }

  protected openEdit(entry: ScheduleEntry): void {
    this.openDialog(entry.employee, entry.date, entry);
  }

  protected roleName(id: string): string {
    return this.roleNames().get(id) ?? 'Job role';
  }

  protected roleColor(id: string): string {
    return this.roleColors().get(id) ?? 'var(--primary)';
  }

  protected timeRange(entry: ScheduleEntry): string {
    return `${timeFromDateTime(entry.starts_at)}–${timeFromDateTime(entry.ends_at)}`;
  }

  protected updateEmployeeSearch(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.employeeSearch.set(target.value);
  }

  protected exportCsv(): void {
    const csv = buildScheduleEntriesCsv(this.entries(), this.employeeNames(), this.roleNames());
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = `schedule-${this.weekStartIso()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private openDialog(employeeId: string, date: string, entry?: ScheduleEntry): void {
    const catalog = this.catalog();
    if (!catalog) return;
    this.dialog.open(ScheduleEntryDialogComponent, {
      contentClass: 'sm:max-w-xl',
      context: {
        entry,
        employeeId,
        date: date.slice(0, 10),
        employees: catalog.employees,
        jobRoles: catalog.jobRoles,
        shiftTemplates: catalog.shiftTemplates,
        onSaved: (saved: ScheduleEntry) => this.upsertEntry(saved),
        onDeleted: (id: string) => this.removeEntry(id),
      },
    });
  }

  private upsertEntry(entry: ScheduleEntry): void {
    const entries = this.localChanges() ?? this.entriesResource.value() ?? [];
    const previous = entries.filter((item) => item.id !== entry.id);
    this.localChanges.set([...previous, entry]);
  }

  private removeEntry(id: string): void {
    const entries = this.localChanges() ?? this.entriesResource.value() ?? [];
    this.localChanges.set(entries.filter((entry) => entry.id !== id));
  }

  private async moveScheduleEntry(entry: ScheduleEntry, destination: ScheduleCell): Promise<void> {
    if (entry.employee === destination.employeeId && entry.date.slice(0, 10) === destination.date) return;
    if (this.movingEntryIds().has(entry.id)) return;

    const destinationEmployee = this.catalog()?.employees.find(
      (employee) => employee.id === destination.employeeId,
    );
    if (!destinationEmployee?.job_roles.some((role) => role.job_role === entry.job_role)) {
      this.alerts.error('Cannot move schedule entry', {
        description: 'The destination employee does not have the required job role.',
      });
      return;
    }

    const datetimes = localScheduleDatetimes(
      destination.date,
      timeFromDateTime(entry.starts_at),
      timeFromDateTime(entry.ends_at),
    );
    this.movingEntryIds.update((ids) => new Set([...ids, entry.id]));
    try {
      const saved = await firstValueFrom(
        this.scheduleEntriesService.update(entry.id, {
          employee: destination.employeeId,
          date: destination.date,
          starts_at: datetimes.startsAt,
          ends_at: datetimes.endsAt,
          job_role: entry.job_role,
          work_area: entry.work_area ?? null,
          notes: entry.notes ?? '',
        }),
      );
      this.upsertEntry(saved);
    } catch (error: unknown) {
      this.alerts.error('Could not move schedule entry', { description: apiErrorMessage(error) });
    } finally {
      this.movingEntryIds.update((ids) => {
        const next = new Set(ids);
        next.delete(entry.id);
        return next;
      });
    }
  }

  private moveWeek(days: number): void {
    const date = new Date(this.weekStart());
    date.setDate(date.getDate() + days);
    this.selectedDate.set(localDate(date));
    this.localChanges.set(null);
  }

  private cellKey(employee: string, date: string): string {
    return `${employee}:${date.slice(0, 10)}`;
  }

  protected dropListId(employeeId: string, date: string): string {
    return `schedule-cell-${employeeId}-${date}`;
  }

  private startOfWeek(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));
    result.setHours(0, 0, 0, 0);
    return result;
  }

  private formatDay(date: Date): string {
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}

function isScheduleEntry(value: PlanningDragData): value is ScheduleEntry {
  return 'starts_at' in value && 'ends_at' in value && 'job_role' in value && 'date' in value;
}

function isEmployee(value: PlanningDragData): value is Employee {
  return 'first_name' in value && 'last_name' in value && 'job_roles' in value;
}

function apiErrorMessage(error: unknown): string {
  if (!isErrorResponse(error)) return 'The server could not move this schedule entry.';
  if (typeof error.error === 'string') return error.error;
  if (error.error && typeof error.error === 'object') {
    const message = Object.values(error.error)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter((value): value is string => typeof value === 'string')
      .join(' ');
    if (message) return message;
  }
  return 'The server could not move this schedule entry.';
}

function isErrorResponse(value: unknown): value is { error: unknown } {
  return typeof value === 'object' && value !== null && 'error' in value;
}
