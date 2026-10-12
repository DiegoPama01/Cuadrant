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
import { ShiftTemplatesService } from '../planning/shift-templates.service';

@Component({
  selector: 'app-shifts',
  imports: [RouterLink, HlmAlertDialogImports, HlmButtonImports, HlmCardImports, HlmTableImports, HlmTooltipImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shifts.component.html',
})
export class ShiftsComponent {
  private readonly shiftTemplatesService = inject(ShiftTemplatesService);
  private readonly deletingIds = signal<Set<string>>(new Set());

  protected readonly shiftTemplatesResource = resource({
    loader: async () => firstValueFrom(this.shiftTemplatesService.list()),
  });

  protected readonly shiftTemplates = computed(() => this.shiftTemplatesResource.value() ?? []);
  protected readonly isDeleting = (shiftId: string) => this.deletingIds().has(shiftId);
  protected readonly shiftTemplatesError = computed(() => {
    const error = this.shiftTemplatesResource.error();

    if (!error) {
      return null;
    }

    return error instanceof Error
      ? error.message
      : 'We could not load shift templates right now. Please try again.';
  });

  protected reload(): void {
    void this.shiftTemplatesResource.reload();
  }

  protected async deleteShiftTemplate(shiftTemplateId: string): Promise<void> {
    this.deletingIds.update((ids) => new Set(ids).add(shiftTemplateId));

    try {
      await firstValueFrom(this.shiftTemplatesService.delete(shiftTemplateId));
      await this.shiftTemplatesResource.reload();
    } finally {
      this.deletingIds.update((ids) => {
        const next = new Set(ids);
        next.delete(shiftTemplateId);
        return next;
      });
    }
  }
}
