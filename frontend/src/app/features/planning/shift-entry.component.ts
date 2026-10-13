import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CdkDrag } from '@angular/cdk/drag-drop';
import { ScheduleEntry } from './schedule-entry.model';

@Component({
  selector: 'app-shift-entry',
  imports: [CdkDrag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      cdkDrag
      [cdkDragData]="entry()"
      [cdkDragDisabled]="disabled()"
      type="button"
      class="border-current/30 hover:border-current/50 focus-visible:ring-ring flex min-h-[68px] w-full flex-col items-start justify-start cursor-grab rounded-md border px-1.5 py-1 text-left text-xs transition-colors active:cursor-grabbing focus-visible:ring-2 focus-visible:outline-none disabled:cursor-wait"
      [style.color]="baseColor()"
      [style.background]="backgroundColor()"
      [attr.aria-label]="'Drag or edit ' + timeRange() + ' ' + roleName()"
      (click)="editEntry($event)"
    >
      <span class="block truncate font-semibold">{{ roleName() }}</span>
      <span class="text-muted-foreground block text-xl leading-none">{{ timeRange() }}</span>
      @if (entry().notes) {
        <span class="text-muted-foreground block truncate">{{ entry().notes }}</span>
      }
    </button>
  `,
})
export class ShiftEntryComponent {
  readonly entry = input.required<ScheduleEntry>();
  readonly roleName = input.required<string>();
  readonly baseColor = input.required<string>();
  readonly timeRange = input.required<string>();
  readonly disabled = input(false);
  readonly edit = output<ScheduleEntry>();

  protected backgroundColor(): string {
    return `color-mix(in srgb, ${this.baseColor()} 10%, transparent)`;
  }

  protected editEntry(event: MouseEvent): void {
    event.stopPropagation();
    this.edit.emit(this.entry());
  }
}
