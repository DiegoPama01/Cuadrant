import { computed, Injectable, signal } from '@angular/core';
import type { PlanningIssue } from './planning.model';

@Injectable()
export class PlanningIssuesService {
  private readonly issuesState = signal<PlanningIssue[]>([]);
  readonly issues = this.issuesState.asReadonly();
  readonly warnings = computed(() => this.issuesState().filter((issue) => issue.severity === 'warning'));

  forWeek(dates: readonly string[]): PlanningIssue[] {
    const weekDates = new Set(dates);
    return this.warnings().filter((issue) => weekDates.has(issue.date));
  }

  replaceForEmployeeDate(employeeId: string, date: string, issues: PlanningIssue[]): void {
    this.issuesState.update((current) => [
      ...current.filter((issue) => !(issue.employeeId === employeeId && issue.date === date)),
      ...issues,
    ]);
  }

  replaceServerIssues(issues: PlanningIssue[]): void {
    const serverIssueCodes = new Set([
      'position_not_required',
      'requirement_capacity_exceeded',
      'availability',
      'approved_time_off',
      'unavailable_exception',
    ]);
    const supersededLocalCodes = new Set(['position_incompatible', 'required_positions_filled']);
    this.issuesState.update((current) => [
      ...current.filter(
        (issue) => !serverIssueCodes.has(issue.code) && !supersededLocalCodes.has(issue.code),
      ),
      ...issues,
    ]);
  }

  clear(): void {
    this.issuesState.set([]);
  }
}
