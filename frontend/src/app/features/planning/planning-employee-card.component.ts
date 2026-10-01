import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CdkDrag } from '@angular/cdk/drag-drop';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { Employee } from '../employees/employees.model';

@Component({ selector: 'app-planning-employee-card', imports: [CdkDrag, HlmButtonImports, HlmCardImports], changeDetection: ChangeDetectionStrategy.OnPush, template: `
  <hlm-card cdkDrag [cdkDragData]="employee()" size="sm" [class]="compact() ? 'cursor-grab rounded-lg border-border/80 p-1.5 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing' : 'cursor-grab rounded-lg !border-0 p-2 !shadow-none active:cursor-grabbing'">
    <div class="flex items-center gap-2" [class.gap-1.5]="compact()"><span class="flex size-8 shrink-0 items-center justify-center rounded-md border-2 bg-muted text-xs font-semibold text-foreground" [class.size-6]="compact()" [style.border-color]="employee().color || null" [style.color]="employee().color || null" [style.background-color]="avatarBackground()" aria-hidden="true">{{ initials() }}</span><div class="min-w-0 flex-1"><p class="truncate text-sm font-medium leading-tight" [class.text-xs]="compact()">{{ employeeName() }}</p>@if (positionName()) { <p class="text-muted-foreground truncate text-xs" [style.font-size]="compact() ? '0.625rem' : null">{{ positionName() }}</p> }</div>@if (removable()) { <button hlmBtn type="button" variant="ghost" size="icon-sm" (click)="$event.stopPropagation(); removed.emit(employee().id)" [attr.aria-label]="'Remove employee ' + employeeName()">×</button> }</div>
  </hlm-card>
` })
export class PlanningEmployeeCardComponent {
  readonly employee = input.required<Employee>();
  readonly positionName = input.required<string>();
  readonly removable = input(false);
  readonly compact = input(false);
  readonly removed = output<string>();
  protected readonly employeeName = computed(() => `${this.employee().first_name} ${this.employee().last_name}`.trim());
  protected readonly initials = computed(() => `${this.employee().first_name[0] ?? ''}${this.employee().last_name[0] ?? ''}`.toUpperCase());
  protected readonly avatarBackground = computed(() => {
    const color = this.employee().color?.trim();
    return color ? `color-mix(in srgb, ${color} 14%, white)` : null;
  });
}
