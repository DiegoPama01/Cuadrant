import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { Employee } from '../employees/employees.model';
import { PlanningZoneShift } from './planning.model';
import { PlanningEmployeeCardComponent } from './planning-employee-card.component';

export interface PlanningDropListData {
  date: string;
  preset: PlanningZoneShift;
}

export interface PlanningDropEvent {
  employee: Employee;
  source: PlanningDropListData | null;
}

@Component({ selector: 'app-planning-drop-zone', imports: [CdkDropList, PlanningEmployeeCardComponent], changeDetection: ChangeDetectionStrategy.OnPush, template: `
  <div cdkDropList [cdkDropListData]="dropListData()" cdkDropListSortingDisabled (cdkDropListDropped)="drop($event)" class="flex min-h-24 h-full w-full flex-1 flex-col gap-1.5 p-1.5" [attr.aria-label]="shiftLabel()">
    @for (employee of assigned(); track employee.id) { <app-planning-employee-card [employee]="employee" [positionName]="positionName()" [removable]="true" (removed)="removed.emit($event)" /> }
  </div>
` })
export class PlanningDropZoneComponent {
  readonly preset = input.required<PlanningZoneShift>();
  readonly assigned = input.required<Employee[]>();
  readonly date = input.required<string>();
  readonly positionName = input('');
  readonly requiredPositionIds = input.required<string[]>();
  readonly shiftLabel = input.required<string>();
  readonly dropped = output<PlanningDropEvent>();
  readonly removed = output<string>();
  protected dropListData(): PlanningDropListData { return { date: this.date(), preset: this.preset() }; }
  protected drop(event: CdkDragDrop<PlanningDropListData, PlanningDropListData | Employee[], Employee>): void {
    if (event.item.data) {
      if (this.assigned().some((employee) => employee.id === event.item.data.id)) return;
      const source = event.previousContainer.data;
      this.dropped.emit({ employee: event.item.data, source: Array.isArray(source) ? null : source });
    }
  }
}
