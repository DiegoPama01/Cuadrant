import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import type { PlanningIssue } from './planning.model';

@Component({
  selector: 'app-planning-issues-sheet',
  imports: [NgIcon, HlmBadgeImports, HlmButtonImports, HlmSheetImports],
  host: { class: 'ml-auto' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-sheet side="right">
      <button
        hlmSheetTrigger
        hlmBtn
        variant="outline"
        size="sm"
        type="button"
        aria-label="View weekly planning warnings"
        [disabled]="issues().length === 0"
      >
        <ng-icon name="lucideTriangleAlert" aria-hidden="true" /> Warnings
        <span hlmBadge variant="outline">{{ issues().length }}</span>
      </button>
      <hlm-sheet-content *hlmSheetPortal="let ctx" class="flex flex-col gap-4 overflow-y-auto">
        <hlm-sheet-header>
          <h2 hlmSheetTitle>Weekly warnings</h2>
          <p hlmSheetDescription>Informational assignment issues for this week.</p>
        </hlm-sheet-header>
        @if (issues().length > 0) {
          <ul class="space-y-3 overflow-y-auto" aria-label="Assignment warnings">
            @for (issue of issues(); track issue.code + issue.employeeId + issue.date) {
              <li class="rounded-md border p-3 text-sm">
                <p class="font-medium">{{ employeeNames().get(issue.employeeId) ?? issue.employeeId }}</p>
                <p>{{ issue.message }}</p>
                <time class="text-muted-foreground text-xs" [attr.datetime]="issue.date">{{ issue.date }}</time>
              </li>
            }
          </ul>
        } @else {
          <p class="text-muted-foreground px-4 text-sm">No warnings this week.</p>
        }
      </hlm-sheet-content>
    </hlm-sheet>
  `,
})
export class PlanningIssuesSheetComponent {
  readonly issues = input.required<PlanningIssue[]>();
  readonly employeeNames = input.required<Map<string, string>>();
}
