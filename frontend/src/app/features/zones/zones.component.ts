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
import { ZonesService } from './zones.service';

@Component({
  selector: 'app-zones',
  imports: [RouterLink, HlmAlertDialogImports, HlmButtonImports, HlmCardImports, HlmTableImports, HlmTooltipImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './zones.component.html',
})
export class ZonesComponent {
  private readonly zonesService = inject(ZonesService);
  private readonly deletingIds = signal<Set<string>>(new Set());

  protected readonly zonesResource = resource({
    loader: async () => firstValueFrom(this.zonesService.list()),
  });

  protected readonly zones = computed(() => this.zonesResource.value() ?? []);
  protected readonly isDeleting = (zoneId: string) => this.deletingIds().has(zoneId);
  protected readonly zonesError = computed(() => {
    const error = this.zonesResource.error();

    if (!error) {
      return null;
    }

    return error instanceof Error
      ? error.message
      : 'We could not load zones right now. Please try again.';
  });

  protected reload(): void {
    void this.zonesResource.reload();
  }

  protected async deleteZone(zoneId: string, zoneName: string): Promise<void> {
    this.deletingIds.update((ids) => new Set(ids).add(zoneId));

    try {
      await firstValueFrom(this.zonesService.delete(zoneId));
      await this.zonesResource.reload();
    } finally {
      this.deletingIds.update((ids) => {
        const next = new Set(ids);
        next.delete(zoneId);
        return next;
      });
    }
  }
}
