import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
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
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmSwitchImports, HlmTextareaImports,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shifts-form.component.html',
})
export class ShiftsFormComponent {
  private readonly router = inject(Router);
  readonly initialValue = input.required<ShiftTemplateUpsertPayload>();
  readonly submitLabel = input('Save shift template');
  readonly formError = input<string | null>(null);
  readonly submitForm = input.required<(value: ShiftTemplateUpsertPayload) => Promise<void>>();
  readonly cancelLink = input.required<string>();

  protected async cancel(): Promise<void> {
    await this.router.navigateByUrl(this.cancelLink());
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
