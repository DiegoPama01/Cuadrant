import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { ShiftsService } from './shifts.service';

@Component({
  selector: 'app-shifts',
  imports: [RouterLink, HlmAlertDialogImports, HlmButtonImports, HlmCardImports, HlmTableImports, HlmTooltipImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shifts.component.html',
})
export class ShiftsComponent {
  private readonly shiftsService = inject(ShiftsService);
  private readonly deletingIds = signal<Set<string>>(new Set());

  protected readonly shiftsResource = resource({
    loader: async () => firstValueFrom(this.shiftsService.list()),
  });

  protected readonly shifts = computed(() => this.shiftsResource.value() ?? []);
  protected readonly isDeleting = (shiftId: string) => this.deletingIds().has(shiftId);
  protected readonly shiftsError = computed(() => {
    const error = this.shiftsResource.error();

    if (!error) {
      return null;
    }

    return error instanceof Error
      ? error.message
      : 'We could not load shifts right now. Please try again.';
  });

  protected reload(): void {
    void this.shiftsResource.reload();
  }

  protected async deleteShift(shiftId: string, shiftName: string): Promise<void> {
    this.deletingIds.update((ids) => new Set(ids).add(shiftId));

    try {
      await firstValueFrom(this.shiftsService.delete(shiftId));
      await this.shiftsResource.reload();
    } finally {
      this.deletingIds.update((ids) => {
        const next = new Set(ids);
        next.delete(shiftId);
        return next;
      });
    }
  }
}
