import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  resource,
  signal,
} from '@angular/core';
import { CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { firstValueFrom, forkJoin } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronLeft,
  lucideChevronRight,
  lucideClock3,
  lucideDownload,
  lucideListFilter,
  lucideRefreshCw,
  lucideUserRound,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmDatePickerImports } from '@spartan-ng/helm/date-picker';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { AlertService } from '../../core/alerts/alert.service';
import { EmployeesService } from '../employees/employees.service';
import { PositionsService } from '../positions/positions.service';
import { ShiftsService } from '../shifts/shifts.service';
import { ZonesService } from '../zones/zones.service';
import { Employee } from '../employees/employees.model';
import { Position } from '../positions/positions.model';
import { Shift } from '../shifts/shifts.model';
import { Zone } from '../zones/zones.model';
import type {
  EmployeeAvailability,
  EmployeeAvailabilityException,
  EmployeePosition,
  EmployeeTimeOff,
  EmployeeZone,
  PlanningZoneShift,
  PlanningWeekResponse,
  PlanningWeekWritePayload,
  PlanningIssue,
} from './planning.model';
import { PlanningService } from './planning.service';
import { buildPlanningCsv, type PlanningExportRow } from './planning-export';
import { PlanningEmployeeCardComponent } from './planning-employee-card.component';
import { PlanningDropEvent, PlanningDropZoneComponent } from './planning-drop-zone.component';
import { buildPlanningRows, type PlanningRow } from './planning-rows';
import { PlanningIssuesService } from './planning-issues.service';
import { PlanningIssuesSheetComponent } from './planning-issues-sheet.component';

interface Day {
  label: string;
  dateLabel: string;
  isoDate: string;
}
interface Assignment {
  zoneId: string;
  shiftId: string;
  positionId: string;
  note: string;
}
@Component({
  selector: 'app-planning',
  imports: [
    NgIcon,
    CdkDropList,
    CdkDropListGroup,
    HlmButtonImports,
    HlmCardImports,
    HlmBadgeImports,
    HlmDatePickerImports,
    HlmTableImports,
    HlmInputImports,
    HlmDropdownMenuImports,
    PlanningEmployeeCardComponent,
    PlanningDropZoneComponent,
    PlanningIssuesSheetComponent,
  ],
  providers: [
    PlanningIssuesService,
    provideIcons({
      lucideChevronLeft,
      lucideChevronRight,
      lucideClock3,
      lucideDownload,
      lucideListFilter,
      lucideRefreshCw,
      lucideUserRound,
      lucideTriangleAlert,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './planning.component.html',
})
export class PlanningComponent {
  private readonly employeesService = inject(EmployeesService);
  private readonly positionsService = inject(PositionsService);
  private readonly zonesService = inject(ZonesService);
  private readonly shiftsService = inject(ShiftsService);
  private readonly planningService = inject(PlanningService);
  private readonly alerts = inject(AlertService);
  private readonly document = inject(DOCUMENT);

  protected readonly selectedDate = signal(this.formatDate(new Date()));
  protected readonly assignments = signal<Record<string, Assignment>>({});
  protected readonly employeeSearch = signal('');
  protected readonly zoneFilter = signal('all');
  protected readonly positionFilter = signal('all');
  protected readonly isSaving = signal(false);
  protected readonly hasPendingChanges = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly planningIssues = inject(PlanningIssuesService);
  protected readonly warningIssues = computed(() =>
    this.planningIssues.forWeek(this.days().map((day) => day.isoDate)),
  );
  protected readonly isExporting = signal(false);
  private readonly autoSaveDelayMs = 2000;
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private autoSaveQueued = false;
  private assignmentRevision = 0;
  protected readonly planningResource = resource({
    loader: async () =>
      firstValueFrom(
        forkJoin({
          employees: this.employeesService.list(),
          positions: this.positionsService.list(),
          zones: this.zonesService.list(),
          shifts: this.shiftsService.list(),
        }),
      ),
  });
  protected readonly planningWeekResource = resource({
    params: () => ({ weekStart: this.weekStartIso() }),
    loader: async ({ params }) => firstValueFrom(this.planningService.getWeek(params.weekStart)),
  });

  protected readonly weekStart = computed(() => this.startOfWeek(new Date(this.selectedDate())));
  protected readonly weekStartIso = computed(() => this.formatDate(this.weekStart()));
  protected readonly weekRangeLabel = computed(() => {
    const start = this.weekStart();
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${this.formatDay(start)} - ${this.formatDay(end)}`;
  });
  protected readonly days = computed<Day[]>(() =>
    Array.from({ length: 7 }, (_, index) => {
      const date = new Date(this.weekStart());
      date.setDate(date.getDate() + index);
      return {
        label: date.toLocaleDateString('en-GB', { weekday: 'short' }),
        dateLabel: this.formatDay(date),
        isoDate: this.formatDate(date),
      };
    }),
  );
  protected readonly data = computed(() => this.planningResource.value());
  protected readonly week = computed(() => this.planningWeekResource.value());
  protected readonly presets = computed<PlanningZoneShift[]>(() => {
    const pairs = new Map<string, PlanningZoneShift>();
    for (const requirement of this.staffRequirements()) {
      const id = `${requirement.zone}:${requirement.shift}`;
      if (!pairs.has(id))
        pairs.set(id, {
          id,
          zone: requirement.zone,
          shift: requirement.shift,
          active: true,
          sort_order: 0,
        });
    }
    return [...pairs.values()];
  });
  protected readonly rows = computed<PlanningRow[]>(() => {
    const data = this.data();
    if (!data) return [];
    return buildPlanningRows(data.positions, data.zones, this.presets(), this.staffRequirements(), {
      zone: this.zoneFilter(),
      shift: 'all',
      position: this.positionFilter(),
    });
  });
  protected readonly visibleEmployees = computed(() => {
    const query = this.employeeSearch().trim().toLocaleLowerCase();
    return (this.data()?.employees ?? []).filter(
      (employee) =>
        employee.active &&
        `${employee.first_name} ${employee.last_name}`.toLocaleLowerCase().includes(query),
    );
  });
  protected readonly visibleStaffCount = computed(() => this.visibleEmployees().length);
  protected readonly employeeById = computed(
    () => new Map((this.data()?.employees ?? []).map((employee) => [employee.id, employee])),
  );
  protected readonly employeeNames = computed(
    () => new Map((this.data()?.employees ?? []).map((employee) => [employee.id, `${employee.first_name} ${employee.last_name}`.trim()])),
  );
  protected readonly zoneById = computed(
    () => new Map((this.data()?.zones ?? []).map((zone) => [zone.id, zone])),
  );
  protected readonly shiftById = computed(
    () => new Map((this.data()?.shifts ?? []).map((shift) => [shift.id, shift])),
  );
  protected readonly staffRequirements = computed(() => {
    const week = this.week();
    const staffRequirements = week?.staff_requirements ?? [];
    return staffRequirements.length > 0 ? staffRequirements : (week?.requirements ?? []);
  });
  protected readonly employeePositionsByEmployee = computed(() =>
    this.groupByEmployee(this.week()?.employee_positions ?? []),
  );
  protected readonly employeeZonesByEmployee = computed(() =>
    this.groupByEmployee(this.week()?.employee_zones ?? []),
  );
  protected readonly employeeAvailabilitiesByEmployee = computed(() =>
    this.groupByEmployee(this.week()?.employee_availabilities ?? []),
  );
  protected readonly timeOffByEmployee = computed(() =>
    this.groupByEmployee(this.week()?.employee_time_offs ?? []),
  );
  protected readonly availabilityExceptionsByEmployee = computed(() =>
    this.groupByEmployee(this.week()?.employee_availability_exceptions ?? []),
  );

  constructor() {
    effect(() => {
      const week = this.week();
      if (week) this.syncAssignments(week);
    });
  }

  protected reload(): void {
    void this.planningResource.reload();
    void this.planningWeekResource.reload();
  }
  protected previousWeek(): void {
    this.moveWeek(-7);
  }
  protected nextWeek(): void {
    this.moveWeek(7);
  }
  protected updateDate(date: Date | null | undefined): void {
    if (date) this.selectedDate.set(this.formatDate(date));
  }
  protected moveWeek(days: number): void {
    const date = new Date(this.weekStart());
    date.setDate(date.getDate() + days);
    this.selectedDate.set(this.formatDate(date));
  }
  protected employeeName(id: string): string {
    const employee = this.employeeById().get(id);
    return employee ? `${employee.first_name} ${employee.last_name}`.trim() : 'Unknown employee';
  }
  protected employeePositionId(employee: Employee): string {
    return this.primaryPositionId(employee);
  }
  protected positionName(id: string): string {
    return (
      this.data()?.positions.find((position) => position.id === id)?.name ?? 'Unknown position'
    );
  }
  protected zoneName(id: string): string {
    return this.zoneById().get(id)?.name ?? 'Zone';
  }
  protected zoneColor(id: string): string {
    return this.zoneById().get(id)?.color ?? 'currentColor';
  }
  protected shiftName(id: string): string {
    return this.shiftById().get(id)?.name ?? 'Shift';
  }
  protected shiftLabel(id: string): string {
    const shift = this.shiftById().get(id);
    return shift
      ? `${shift.name} ${shift.start_time.slice(0, 5)}-${shift.end_time.slice(0, 5)}`
      : 'Shift';
  }
  protected assignmentsFor(row: PlanningRow, date: string): Employee[] {
    return (this.data()?.employees ?? []).filter((employee) => {
      const assignment = this.assignments()[this.key(employee.id, date)];
      return assignment?.zoneId === row.preset.zone && assignment.shiftId === row.preset.shift;
    });
  }
  protected coverage(row: PlanningRow, date: string): number {
    return this.assignmentsFor(row, date).length;
  }
  protected requiredCount(row: PlanningRow, date: string): number {
    return this.requirementsForDate(row, date).reduce(
      (total, requirement) => total + requirement.required_employees,
      0,
    );
  }
  protected requiredPositionIds(row: PlanningRow): string[] {
    return row.requirements.map((requirement) => requirement.position.id);
  }
  protected employeeCardPositionName(employee: Employee, row?: PlanningRow): string {
    const matchingPosition = row?.requirements.find((requirement) =>
      this.employeePositionIds(employee).includes(requirement.position.id),
    )?.position.id;
    return this.positionName(matchingPosition ?? this.primaryPositionId(employee));
  }
  protected moveEmployee(event: PlanningDropEvent, date: string, preset: PlanningZoneShift): void {
    const employeeId = event.employee.id;
    const employee = this.employeeById().get(employeeId);
    const row = this.rows().find(
      (item) => item.preset.zone === preset.zone && item.preset.shift === preset.shift,
    );
    const issues = this.assignmentIssues(employee, row, date, preset);
    const blockingIssue = issues.find((issue) => issue.severity === 'error');
    if (blockingIssue) {
      this.planningIssues.replaceForEmployeeDate(employeeId, date, issues);
      this.alerts.error(blockingIssue.message);
      return;
    }
    const requiredPositionId = this.positionForDrop(employee!, row!, date);
    const positionId = requiredPositionId ?? this.primaryPositionId(employee!);
    if (!requiredPositionId && row?.requirements.length) {
      issues.push({
        code: 'required_positions_filled',
        severity: 'warning',
        message: 'No required positions are available; the employee will be assigned to their primary position.',
        employeeId,
        date,
      });
    }
    this.planningIssues.replaceForEmployeeDate(employeeId, date, issues);
    if (issues.length > 0) {
      this.alerts.warning('Assignment saved with warnings', {
        description: issues.map((issue) => issue.message).join(' '),
      });
    }
    if (
      event.source?.date === date &&
      event.source.preset.zone === preset.zone &&
      event.source.preset.shift === preset.shift
    ) {
      this.assignments.update((state) => ({ ...state }));
      return;
    }
    this.assignments.update((state) => {
      const next = { ...state };
      delete next[this.key(employeeId, date)];
      if (event.source) delete next[this.key(employeeId, event.source.date)];
      next[this.key(employeeId, date)] = {
        zoneId: preset.zone,
        shiftId: preset.shift,
        positionId,
        note: '',
      };
      return next;
    });
    this.assignmentRevision += 1;
    this.hasPendingChanges.set(true);
    this.saveError.set(null);
    this.scheduleAutoSave();
  }
  protected remove(employeeId: string, date: string): void {
    this.assignments.update((state) => {
      const next = { ...state };
      delete next[this.key(employeeId, date)];
      return next;
    });
    this.assignmentRevision += 1;
    this.hasPendingChanges.set(true);
    this.scheduleAutoSave();
  }
  protected exportPlanning(): void {
    const data = this.data();
    if (!data || this.isExporting()) return;
    this.isExporting.set(true);
    try {
      const rows: PlanningExportRow[] = data.employees
        .filter((employee) => employee.active)
        .map((employee) => ({
          employee: this.employeeName(employee.id),
          position: this.positionName(this.primaryPositionId(employee)),
          cells: this.days().map((day) => {
            const assignment = this.assignments()[this.key(employee.id, day.isoDate)];
            const shift = assignment ? this.shiftById().get(assignment.shiftId) : undefined;
            return {
              date: day.isoDate,
              day: day.label,
              zone: assignment ? this.zoneName(assignment.zoneId) : '',
              shift: shift?.name ?? '',
              startTime: shift?.start_time ?? '',
              endTime: shift?.end_time ?? '',
              note: assignment?.note ?? '',
            };
          }),
        }));
      const blob = new Blob([`\ufeff${buildPlanningCsv(rows)}`], {
        type: 'text/csv;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = this.document.createElement('a');
      link.href = url;
      link.download = `planning-${this.weekStartIso()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      this.isExporting.set(false);
    }
  }
  private syncAssignments(week: PlanningWeekResponse): void {
    const next: Record<string, Assignment> = {};
    for (const assignment of week.assignments)
      next[this.key(assignment.employee, assignment.date ?? assignment.work_date)] = {
        zoneId: assignment.zone,
        shiftId: assignment.shift,
        positionId: assignment.position,
        note: assignment.notes ?? assignment.note ?? '',
      };
    this.assignments.set(next);
    const assignmentById = new Map(week.assignments.map((assignment) => [assignment.id, assignment]));
    this.planningIssues.replaceServerIssues(
      (week.issues ?? []).flatMap((issue) => {
        const assignment = assignmentById.get(issue.assignment);
        if (!assignment) return [];
        const message = issue.code === 'position_not_required'
          ? 'The assigned position is not required for this zone and shift.'
          : issue.code === 'requirement_capacity_exceeded'
            ? 'The required staffing level for this position and shift has been exceeded.'
            : issue.code === 'availability'
              ? 'The employee is outside their weekly availability for this shift.'
              : issue.code === 'approved_time_off'
                ? 'The employee has approved time off during this shift.'
                : issue.code === 'unavailable_exception'
                  ? 'The employee is marked unavailable for this shift.'
            : issue.message;
        return [{
          code: issue.code,
          severity: issue.severity,
          message,
          employeeId: assignment.employee,
          date: assignment.date ?? assignment.work_date,
        }];
      }),
    );
    this.hasPendingChanges.set(false);
  }
  private writePayload(): PlanningWeekWritePayload['assignments'] {
    return Object.entries(this.assignments()).map(([key, assignment]) => {
      const [employee, date] = key.split(':');
      return {
        employee: employee ?? '',
        date: date ?? '',
        zone: assignment.zoneId,
        shift: assignment.shiftId,
        position: assignment.positionId,
        notes: assignment.note,
      };
    });
  }
  private scheduleAutoSave(): void {
    this.autoSaveQueued = true;
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveTimer = null;
      void this.flushAutoSave();
    }, this.autoSaveDelayMs);
  }
  private async flushAutoSave(): Promise<void> {
    if (this.isSaving()) return;
    this.autoSaveQueued = false;
    const revision = this.assignmentRevision;
    const payload = { assignments: this.writePayload() };
    this.isSaving.set(true);
    this.saveError.set(null);
    try {
      const response = await firstValueFrom(
        this.planningService.saveWeek(this.weekStartIso(), payload),
      );
      if (revision === this.assignmentRevision) this.syncAssignments(response);
    } catch {
      this.saveError.set(
        'Could not save planning automatically. Review the assignments and try again.',
      );
      this.alerts.error('Could not save planning automatically.');
    } finally {
      this.isSaving.set(false);
      if (this.autoSaveQueued) this.scheduleAutoSave();
    }
  }
  private key(employee: string, date: string): string {
    return `${employee}:${date.slice(0, 10)}`;
  }
  private primaryPositionId(employee: Employee): string {
    const employeePositions = this.employeePositionRows(employee);
    return (
      employeePositions.find((item) => item.active !== false && item.primary)?.position ??
      employeePositions.find((item) => item.active !== false)?.position ??
      employee.position
    );
  }
  private employeePositionIds(employee: Employee): string[] {
    const employeePositions = this.employeePositionRows(employee);
    const positionIds = employeePositions
      .filter((item) => item.active !== false)
      .map((item) => item.position);
    return positionIds.length > 0 ? positionIds : [employee.position].filter(Boolean);
  }
  private allowedZoneIds(employee: Employee): string[] {
    const employeeZones = this.employeeZoneRows(employee);
    const zoneIds = employeeZones.filter((item) => item.active !== false).map((item) => item.zone);
    return zoneIds.length > 0 ? zoneIds : employee.allowed_zones;
  }
  private canWorkInZone(employee: Employee, zoneId: string): boolean {
    return employee.all_zones === true || this.allowedZoneIds(employee).includes(zoneId);
  }
  private canCoverRequiredPosition(employee: Employee, row: PlanningRow): boolean {
    const positionIds = this.employeePositionIds(employee);
    return row.requirements.some((requirement) => positionIds.includes(requirement.position.id));
  }
  private requirementsForDate(row: PlanningRow, date: string) {
    const dateRequirements = this.staffRequirements().filter(
      (requirement) =>
        requirement.zone === row.preset.zone &&
        requirement.shift === row.preset.shift &&
        requirement.date === date,
    );
    const applicable =
      dateRequirements.length > 0
        ? dateRequirements
        : this.staffRequirements().filter(
            (requirement) =>
              requirement.zone === row.preset.zone &&
              requirement.shift === row.preset.shift &&
              requirement.date == null &&
              requirement.day_of_week === this.mondayFirstDayOfWeek(date),
          );
    return applicable;
  }
  private positionForDrop(employee: Employee, row: PlanningRow, date: string): string | null {
    const positionIds = this.employeePositionIds(employee);
    const primary = this.primaryPositionId(employee);
    const requiredForDate = this.requirementsForDate(row, date);
    const preferredRequirements = [...requiredForDate].sort(
      (a, b) => Number(b.position === primary) - Number(a.position === primary),
    );
    for (const requirement of preferredRequirements) {
      if (!positionIds.includes(requirement.position)) continue;
      const currentCount = Object.entries(this.assignments()).filter(([key, assignment]) => {
        const [, assignedDate] = key.split(':');
        return (
          assignedDate === date &&
          assignment.zoneId === row.preset.zone &&
          assignment.shiftId === row.preset.shift &&
          assignment.positionId === requirement.position
        );
      }).length;
      if (currentCount < requirement.required_employees) return requirement.position;
    }
    return null;
  }
  private assignmentIssues(
    employee: Employee | undefined,
    row: PlanningRow | undefined,
    date: string,
    preset: PlanningZoneShift,
  ): PlanningIssue[] {
    const issues: PlanningIssue[] = [];
    const add = (code: string, severity: PlanningIssue['severity'], message: string): void => {
      issues.push({ code, severity, message, employeeId: employee?.id ?? '', date });
    };
    if (!employee) { add('employee_missing', 'error', 'Could not identify the dragged employee.'); return issues; }
    if (!preset.zone || !preset.shift)
      { add('destination_incomplete', 'error', 'The planning destination is incomplete.'); return issues; }
    if (!this.zoneById().has(preset.zone))
      { add('zone_missing', 'error', 'The destination zone no longer exists or has not been loaded.'); return issues; }
    if (!this.shiftById().has(preset.shift))
      { add('shift_missing', 'error', 'The destination shift no longer exists or has not been loaded.'); return issues; }
    if (!this.canWorkInZone(employee, preset.zone))
      add('zone_not_allowed', 'error', `${this.employeeName(employee.id)} is not allowed to work in ${this.zoneName(preset.zone)}.`);
    if (row && !this.canCoverRequiredPosition(employee, row))
      add('position_incompatible', 'warning', 'The employee does not have any of the positions required for this shift; the assignment will be kept for review.');
    if (!this.isAvailableForShift(employee, date, preset.shift))
      add('availability', 'warning', 'The employee is unavailable according to their weekly availability.');
    if (this.hasApprovedTimeOff(employee.id, date))
      add('approved_time_off', 'warning', 'The employee has approved time off on this day.');
    if (this.hasUnavailableException(employee.id, date, preset.shift))
      add('unavailable_exception', 'warning', 'The employee is marked unavailable for this date or shift.');
    return issues;
  }
  private groupByEmployee<T extends { employee: string }>(items: T[]): Map<string, T[]> {
    const grouped = new Map<string, T[]>();
    for (const item of items)
      grouped.set(item.employee, [...(grouped.get(item.employee) ?? []), item]);
    return grouped;
  }
  private employeePositionRows(employee: Employee): EmployeePosition[] {
    const weekRows = this.employeePositionsByEmployee().get(employee.id) ?? [];
    return weekRows.length > 0
      ? weekRows
      : (employee.employee_positions ?? employee.positions ?? []);
  }
  private employeeZoneRows(employee: Employee): EmployeeZone[] {
    const weekRows = this.employeeZonesByEmployee().get(employee.id) ?? [];
    return weekRows.length > 0 ? weekRows : (employee.employee_zones ?? employee.zones ?? []);
  }
  private employeeAvailabilityRows(employee: Employee): EmployeeAvailability[] {
    const weekRows = this.employeeAvailabilitiesByEmployee().get(employee.id) ?? [];
    return weekRows.length > 0 ? weekRows : (employee.availabilities ?? []);
  }
  private hasApprovedTimeOff(employeeId: string, date: string): boolean {
    return (this.timeOffByEmployee().get(employeeId) ?? []).some(
      (item: EmployeeTimeOff) =>
        item.status === 'approved' && item.start_date <= date && item.end_date >= date,
    );
  }
  private hasUnavailableException(employeeId: string, date: string, shiftId: string): boolean {
    return (this.availabilityExceptionsByEmployee().get(employeeId) ?? []).some(
      (item: EmployeeAvailabilityException) =>
        (item.work_date ?? item.date) === date &&
        (item.status === 'unavailable' || item.available === false) &&
        (!item.shift || item.shift === shiftId),
    );
  }
  private isAvailableForShift(employee: Employee, date: string, shiftId: string): boolean {
    if (employee.availability_unrestricted === true) return true;
    const day = this.mondayFirstDayOfWeek(date);
    const rows = this.employeeAvailabilityRows(employee).filter(
      (availability) => (availability.day_of_week ?? availability.weekday) === day,
    );
    if (rows.length === 0) return employee.availability_unrestricted !== false;
    const availableRows = rows.filter(
      (availability) => availability.available !== false && availability.status !== 'unavailable',
    );
    if (availableRows.length === 0) return false;
    const shift = this.shiftById().get(shiftId);
    if (!shift) return true;
    return availableRows.some((availability) => this.availabilityCoversShift(availability, shift));
  }
  private availabilityCoversShift(availability: EmployeeAvailability, shift: Shift): boolean {
    if (!availability.start_time || !availability.end_time) return true;
    return (
      availability.start_time.slice(0, 5) <= shift.start_time.slice(0, 5) &&
      availability.end_time.slice(0, 5) >= shift.end_time.slice(0, 5)
    );
  }
  private mondayFirstDayOfWeek(date: string): number {
    return (new Date(`${date}T00:00:00`).getDay() + 6) % 7;
  }
  private startOfWeek(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));
    result.setHours(0, 0, 0, 0);
    return result;
  }
  private formatDate(date: Date): string {
    return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
  }
  private formatDay(date: Date): string {
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
