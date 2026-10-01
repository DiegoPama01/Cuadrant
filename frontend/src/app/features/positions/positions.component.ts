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
import { PositionsService } from './positions.service';

@Component({
  selector: 'app-positions',
  imports: [RouterLink, HlmAlertDialogImports, HlmButtonImports, HlmCardImports, HlmTableImports, HlmTooltipImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './positions.component.html',
})
export class PositionsComponent {
  private readonly positionsService = inject(PositionsService);
  private readonly deletingIds = signal<Set<string>>(new Set());

  protected readonly positionsResource = resource({
    loader: async () => firstValueFrom(this.positionsService.list()),
  });

  protected readonly positions = computed(() => this.positionsResource.value() ?? []);
  protected readonly isDeleting = (positionId: string) => this.deletingIds().has(positionId);
  protected readonly positionsError = computed(() => {
    const error = this.positionsResource.error();

    if (!error) {
      return null;
    }

    return error instanceof Error
      ? error.message
      : 'We could not load positions right now. Please try again.';
  });

  protected reload(): void {
    void this.positionsResource.reload();
  }

  protected async deletePosition(positionId: string, positionName: string): Promise<void> {
    this.deletingIds.update((ids) => new Set(ids).add(positionId));

    try {
      await firstValueFrom(this.positionsService.delete(positionId));
      await this.positionsResource.reload();
    } finally {
      this.deletingIds.update((ids) => {
        const next = new Set(ids);
        next.delete(positionId);
        return next;
      });
    }
  }
}
