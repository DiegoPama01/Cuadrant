import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { HlmContextMenuImports } from '@spartan-ng/helm/context-menu';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { ScheduleEntry } from './schedule-entry.model';

@Component({
  selector: 'app-shift-entry',
  imports: [CdkDrag, CdkDragHandle, HlmContextMenuImports, HlmDropdownMenuImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      cdkDrag
      [cdkDragData]="entry()"
      [cdkDragDisabled]="disabled()"
      [hlmContextMenuTrigger]="entryMenu"
      [disabled]="disabled()"
      class="border-current/30 hover:border-current/50 flex min-h-[68px] w-full items-stretch gap-1 rounded-md border px-1.5 py-1 text-sm text-foreground transition-colors"
      [style.background]="backgroundColor()"
      tabindex="0"
      role="group"
      aria-haspopup="menu"
      aria-keyshortcuts="Shift+F10"
      [attr.aria-label]="'Schedule entry: ' + roleName() + ', ' + timeRange() + '. Right-click or press Shift+F10 for actions.'"
    >
      <button
        cdkDragHandle
        type="button"
        class="focus-visible:ring-ring flex min-w-0 flex-1 cursor-grab flex-col items-start justify-start gap-0.5 rounded-sm px-0.5 text-left active:cursor-grabbing focus-visible:ring-2 focus-visible:outline-none disabled:cursor-wait"
        [disabled]="disabled()"
        [attr.aria-label]="'Edit ' + roleName() + ', ' + timeRange()"
        (click)="editEntry($event)"
      >
        <span class="flex w-full min-w-0 items-center gap-1.5">
          <span class="size-2 shrink-0 rounded-full" [style.background-color]="baseColor()" aria-hidden="true"></span>
          <span class="truncate font-semibold">{{ roleName() }}</span>
        </span>
        <span class="block w-full truncate font-medium tabular-nums leading-tight">{{ timeRange() }}</span>
        @if (entry().notes) {
          <span class="block w-full truncate text-xs text-muted-foreground">{{ entry().notes }}</span>
        }
      </button>
      <ng-template #entryMenu>
        <hlm-dropdown-menu>
          <hlm-dropdown-menu-group>
            <button hlmDropdownMenuItem (click)="moveEntry($event)">Move entry</button>
          </hlm-dropdown-menu-group>
        </hlm-dropdown-menu>
      </ng-template>
    </div>
  `,
})
export class ShiftEntryComponent {
  readonly entry = input.required<ScheduleEntry>();
  readonly roleName = input.required<string>();
  readonly baseColor = input.required<string>();
  readonly timeRange = input.required<string>();
  readonly disabled = input(false);
  readonly edit = output<ScheduleEntry>();
  readonly move = output<ScheduleEntry>();

  protected backgroundColor(): string {
    return `color-mix(in srgb, ${this.baseColor()} 10%, var(--card))`;
  }

  protected editEntry(event: MouseEvent): void {
    event.stopPropagation();
    this.edit.emit(this.entry());
  }

  protected moveEntry(event: MouseEvent): void {
    event.stopPropagation();
    this.move.emit(this.entry());
  }
}
