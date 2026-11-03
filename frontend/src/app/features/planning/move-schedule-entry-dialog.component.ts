import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrnDialogRef, injectBrnDialogContext } from '@spartan-ng/brain/dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { Employee } from '../employees/employees.model';
import { ScheduleEntry } from './schedule-entry.model';

export interface MoveScheduleEntryDestination {
  employeeId: string;
  date: string;
}

export interface MoveScheduleEntryDialogContext {
  entry: ScheduleEntry;
  employees: Employee[];
  days: { date: string; label: string }[];
  onMove: (destination: MoveScheduleEntryDestination) => Promise<boolean>;
}

@Component({
  selector: 'app-move-schedule-entry-dialog',
  imports: [FormsModule, HlmButtonImports, HlmDialogImports, HlmFieldImports, HlmSelectImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './move-schedule-entry-dialog.component.html',
})
export class MoveScheduleEntryDialogComponent {
  protected readonly context = injectBrnDialogContext<MoveScheduleEntryDialogContext>();
  private readonly dialogRef = inject(BrnDialogRef);
  protected readonly selectedEmployeeId = signal(this.context.entry.employee);
  protected readonly selectedDate = signal(this.context.entry.date.slice(0, 10));
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly destinationUnchanged = computed(
    () =>
      this.selectedEmployeeId() === this.context.entry.employee &&
      this.selectedDate() === this.context.entry.date.slice(0, 10),
  );
  protected readonly employeeIdToLabel = (employeeId: string | null): string => {
    const employee = this.context.employees.find((item) => item.id === employeeId);
    return employee ? `${employee.first_name} ${employee.last_name}`.trim() : '';
  };
  protected readonly dateToLabel = (date: string | null): string =>
    this.context.days.find((day) => day.date === date)?.label ?? '';

  protected setEmployee(employeeId: string | null | undefined): void {
    if (employeeId) this.selectedEmployeeId.set(employeeId);
  }

  protected setDate(date: string | null | undefined): void {
    if (date) this.selectedDate.set(date);
  }

  protected async move(): Promise<void> {
    if (this.saving() || this.destinationUnchanged()) return;

    this.errorMessage.set(null);
    this.saving.set(true);
    try {
      const moved = await this.context.onMove({
        employeeId: this.selectedEmployeeId(),
        date: this.selectedDate(),
      });
      if (moved) {
        this.dialogRef.close();
      } else {
        this.errorMessage.set('The schedule entry could not be moved. Review the notification and try again.');
      }
    } catch {
      this.errorMessage.set('Could not move this schedule entry. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }
}
