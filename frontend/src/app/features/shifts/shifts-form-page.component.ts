import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { BrnDialogRef, injectBrnDialogContext } from '@spartan-ng/brain/dialog';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { firstValueFrom } from 'rxjs';
import { randomFormColor } from '../../shared/color-utils';
import { ShiftsFormComponent } from './shifts-form.component';
import { ShiftTemplateUpsertPayload } from './shifts.model';
import { ShiftTemplatesService } from '../planning/shift-templates.service';

export interface ShiftTemplateDialogContext {
  shiftTemplateId?: string;
  onSaved: () => void;
}

@Component({
  selector: 'app-shifts-form-page',
  imports: [HlmDialogImports, ShiftsFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shifts-form-page.component.html',
})
export class ShiftsFormPageComponent {
  protected readonly context = injectBrnDialogContext<ShiftTemplateDialogContext>();
  protected readonly dialogRef = inject(BrnDialogRef);
  private readonly shiftTemplatesService = inject(ShiftTemplatesService);

  private readonly shiftId = this.context.shiftTemplateId;
  protected readonly isEditMode = !!this.shiftId;
  protected readonly formError = signal<string | null>(null);

  protected readonly shiftResource = resource({
    loader: async () => {
      if (!this.shiftId) {
        return null;
      }

      return firstValueFrom(this.shiftTemplatesService.get(this.shiftId));
    },
  });

  protected readonly initialValue = computed<ShiftTemplateUpsertPayload>(() => {
    const shift = this.shiftResource.value();

    if (!shift) {
      return {
        name: '',
        code: '',
        description: '',
        start_time: '',
        end_time: '',
        break_minutes: 0,
        color: randomFormColor(),
        active: true,
      };
    }

    return {
      name: shift.name,
      code: shift.code ?? '',
      description: shift.description ?? '',
      start_time: shift.start_time,
      end_time: shift.end_time,
      break_minutes: shift.break_minutes ?? 0,
      color: shift.color,
      active: shift.active,
    };
  });

  protected async saveShiftTemplate(payload: ShiftTemplateUpsertPayload): Promise<void> {
    this.formError.set(null);

    try {
      if (this.shiftId) {
        await firstValueFrom(this.shiftTemplatesService.update(this.shiftId, payload));
      } else {
        await firstValueFrom(this.shiftTemplatesService.create(payload));
      }

      this.context.onSaved();
      this.dialogRef.close();
    } catch {
      this.formError.set(
        'We could not save this shift template. Please review the form and try again.',
      );
    }
  }
}
