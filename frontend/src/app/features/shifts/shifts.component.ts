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
import { ShiftTemplatesService } from '../planning/shift-templates.service';
import { ShiftTemplateDialogContext, ShiftsFormPageComponent } from './shifts-form-page.component';

@Component({
  selector: 'app-shifts',
  imports: [
    HlmAlertDialogImports,
    HlmButtonImports,
    HlmCardImports,
    HlmTableImports,
    HlmTooltipImports,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shifts.component.html',
})
export class ShiftsComponent {
  private readonly shiftTemplatesService = inject(ShiftTemplatesService);
  private readonly dialog = inject(HlmDialogService);
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

  protected openShiftTemplateForm(shiftTemplateId?: string): void {
    this.dialog.open<unknown, ShiftTemplateDialogContext>(ShiftsFormPageComponent, {
      contentClass: 'w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-5xl',
      context: {
        shiftTemplateId,
        onSaved: () => this.reload(),
      },
    });
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
