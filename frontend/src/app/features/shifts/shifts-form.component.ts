import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { randomFormColor } from '../../shared/color-utils';
import { ShiftTemplateUpsertPayload } from './shifts.model';

@Component({
  selector: 'app-shifts-form',
  imports: [
    FormRoot,
    FormField,
    HlmButtonImports,
    HlmDialogImports,
    HlmFieldImports,
    HlmInputImports,
    HlmSwitchImports,
    HlmTextareaImports,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shifts-form.component.html',
})
export class ShiftsFormComponent {
  readonly initialValue = input.required<ShiftTemplateUpsertPayload>();
  readonly submitLabel = input('Save shift template');
  readonly formError = input<string | null>(null);
  readonly submitForm = input.required<(value: ShiftTemplateUpsertPayload) => Promise<void>>();
  readonly cancelled = output<void>();

  protected cancel(): void {
    this.cancelled.emit();
  }

  protected readonly model = signal<ShiftTemplateUpsertPayload>({
    name: '',
    code: '',
    description: '',
    start_time: '',
    end_time: '',
    break_minutes: 0,
    color: randomFormColor(),
    active: true,
  });

  constructor() {
    effect(() => {
      this.model.set(this.initialValue());
    });
  }

  protected readonly shiftForm = form(
    this.model,
    (schema) => {
      required(schema.name, { message: 'Name is required.' });
      required(schema.start_time, { message: 'Start time is required.' });
      required(schema.end_time, { message: 'End time is required.' });
      required(schema.color, { message: 'Color is required.' });
    },
    {
      submission: {
        action: async () => {
          await this.submitForm()({ ...this.model() });
        },
      },
    },
  );

  protected updateActive(active: boolean): void {
    this.model.update((value) => ({ ...value, active }));
  }
}
