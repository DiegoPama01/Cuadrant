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
import { PositionUpsertPayload } from './positions.model';

@Component({
  selector: 'app-positions-form',
  imports: [FormRoot, FormField, HlmButtonImports, HlmCardImports, HlmFieldImports, HlmInputImports, HlmSwitchImports, HlmTextareaImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './positions-form.component.html',
})
export class PositionsFormComponent {
  private readonly router = inject(Router);
  readonly initialValue = input.required<PositionUpsertPayload>();
  readonly submitLabel = input('Save position');
  readonly formError = input<string | null>(null);
  readonly submitForm = input.required<(value: PositionUpsertPayload) => Promise<void>>();
  readonly cancelLink = input.required<string>();

  protected async cancel(): Promise<void> {
    await this.router.navigateByUrl(this.cancelLink());
  }

  protected readonly model = signal<PositionUpsertPayload>({
    name: '',
    code: '',
    description: '',
    color: randomFormColor(),
    sort_order: 0,
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
