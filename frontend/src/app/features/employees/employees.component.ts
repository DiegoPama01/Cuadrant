import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { PositionsService } from '../positions/positions.service';
import { Employee } from './employees.model';
import { EmployeesService } from './employees.service';

interface EmployeeRow {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  color: string | null;
  active: boolean;
  positionName: string;
}

@Component({
  selector: 'app-employees',
  imports: [RouterLink, HlmAlertDialogImports, HlmBadgeImports, HlmButtonImports, HlmCardImports, HlmTableImports, HlmTooltipImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employees.component.html',
})
export class EmployeesComponent {
  private readonly employeesService = inject(EmployeesService);
  private readonly positionsService = inject(PositionsService);
  private readonly deletingIds = signal<Set<string>>(new Set());

  protected readonly employeesResource = resource({
    loader: async () =>
      firstValueFrom(
        forkJoin({
          employees: this.employeesService.list(),
          positions: this.positionsService.list(),
        }),
      ),
  });

  protected readonly employees = computed<EmployeeRow[]>(() => {
    const data = this.employeesResource.value();

    if (!data) {
      return [];
    }

    const positionsById = new Map(data.positions.map((position) => [position.id, position.name]));

    return data.employees.map((employee) =>
      this.mapEmployeeRow(employee, positionsById),
    );
  });
  protected readonly isDeleting = (employeeId: string) => this.deletingIds().has(employeeId);

  protected readonly employeesError = computed(() => {
    const error = this.employeesResource.error();

    if (!error) {
      return null;
    }

    return error instanceof Error
      ? error.message
      : 'We could not load employees right now. Please try again.';
  });

  protected reload(): void {
    void this.employeesResource.reload();
  }

  protected async deleteEmployee(employeeId: string, employeeName: string): Promise<void> {
    this.deletingIds.update((ids) => new Set(ids).add(employeeId));

    try {
      await firstValueFrom(this.employeesService.delete(employeeId));
      await this.employeesResource.reload();
    } finally {
      this.deletingIds.update((ids) => {
        const next = new Set(ids);
        next.delete(employeeId);
        return next;
      });
    }
  }

  private mapEmployeeRow(
    employee: Employee,
    positionsById: Map<string, string>,
  ): EmployeeRow {
    const firstName = employee.first_name.trim();
    const lastName = employee.last_name.trim();
    const fullName = `${firstName} ${lastName}`.trim();

    return {
      id: employee.id,
      firstName,
      lastName,
      fullName: fullName || 'Unnamed employee',
      color: employee.color ?? null,
      active: employee.active,
      positionName: positionsById.get(employee.position) ?? 'Unknown position',
    };
  }
}
