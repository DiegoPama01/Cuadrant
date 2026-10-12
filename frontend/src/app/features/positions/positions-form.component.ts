import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { randomFormColor } from '../../shared/color-utils';
import { JobRoleUpsertPayload } from '../job-roles/job-roles.model';

@Component({
  selector: 'app-positions-form',
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
  templateUrl: './positions-form.component.html',
})
export class PositionsFormComponent {
  readonly initialValue = input.required<JobRoleUpsertPayload>();
  readonly submitLabel = input('Save job role');
  readonly formError = input<string | null>(null);
  readonly submitForm = input.required<(value: JobRoleUpsertPayload) => Promise<void>>();
  readonly cancelled = output<void>();

  protected cancel(): void {
    this.cancelled.emit();
  }

  protected readonly model = signal<JobRoleUpsertPayload>({
    name: '',
    code: '',
    description: '',
    color: randomFormColor(),
    active: true,
  });

  constructor() {
    effect(() => {
      this.model.set(this.initialValue());
    });
  }

  protected readonly positionForm = form(
    this.model,
    (schema) => {
      required(schema.name, { message: 'Name is required.' });
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
