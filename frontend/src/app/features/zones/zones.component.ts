import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmDialogService } from '@spartan-ng/helm/dialog';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { WorkAreasService } from './zones.service';
import { WorkAreaDialogContext, ZonesFormPageComponent } from './zones-form-page.component';

@Component({
  selector: 'app-zones',
  imports: [
    HlmAlertDialogImports,
    HlmButtonImports,
    HlmCardImports,
    HlmTableImports,
    HlmTooltipImports,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './zones.component.html',
})
export class ZonesComponent {
  private readonly workAreasService = inject(WorkAreasService);
  private readonly dialog = inject(HlmDialogService);
  private readonly deletingIds = signal<Set<string>>(new Set());

  protected readonly workAreasResource = resource({
    loader: async () => firstValueFrom(this.workAreasService.list()),
  });

  protected readonly workAreas = computed(() => this.workAreasResource.value() ?? []);
  protected readonly isDeleting = (zoneId: string) => this.deletingIds().has(zoneId);
  protected readonly workAreasError = computed(() => {
    const error = this.workAreasResource.error();

    if (!error) {
      return null;
    }

    return error instanceof Error
      ? error.message
      : 'We could not load work areas right now. Please try again.';
  });

  protected reload(): void {
    void this.workAreasResource.reload();
  }

  protected openWorkAreaForm(workAreaId?: string): void {
    this.dialog.open<unknown, WorkAreaDialogContext>(ZonesFormPageComponent, {
      contentClass: 'w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-4xl',
      context: {
        workAreaId,
        onSaved: () => this.reload(),
      },
    });
  }

  protected async deleteWorkArea(workAreaId: string): Promise<void> {
    this.deletingIds.update((ids) => new Set(ids).add(workAreaId));

    try {
      await firstValueFrom(this.workAreasService.delete(workAreaId));
      await this.workAreasResource.reload();
    } finally {
      this.deletingIds.update((ids) => {
        const next = new Set(ids);
        next.delete(workAreaId);
        return next;
      });
    }
  }
}
