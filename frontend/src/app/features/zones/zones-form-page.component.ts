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
import { ZonesFormComponent } from './zones-form.component';
import { WorkAreaUpsertPayload } from './zones.model';
import { WorkAreasService } from './zones.service';

export interface WorkAreaDialogContext {
  workAreaId?: string;
  onSaved: () => void;
}

@Component({
  selector: 'app-zones-form-page',
  imports: [HlmDialogImports, ZonesFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './zones-form-page.component.html',
})
export class ZonesFormPageComponent {
  protected readonly context = injectBrnDialogContext<WorkAreaDialogContext>();
  protected readonly dialogRef = inject(BrnDialogRef);
  private readonly workAreasService = inject(WorkAreasService);

  private readonly zoneId = this.context.workAreaId;
  protected readonly isEditMode = !!this.zoneId;
  protected readonly formError = signal<string | null>(null);

  protected readonly workAreaResource = resource({
    loader: async () => {
      if (!this.zoneId) {
        return null;
      }

      return firstValueFrom(this.workAreasService.get(this.zoneId));
    },
  });

  protected readonly initialValue = computed<WorkAreaUpsertPayload>(() => {
    const workArea = this.workAreaResource.value();

    if (!workArea) {
      return {
        name: '',
        description: '',
        color: randomFormColor(),
        active: true,
      };
    }

    return {
      name: workArea.name,
      description: workArea.description ?? '',
      color: workArea.color,
      active: workArea.active,
    };
  });

  protected async saveWorkArea(payload: WorkAreaUpsertPayload): Promise<void> {
    this.formError.set(null);

    try {
      if (this.zoneId) {
        await firstValueFrom(this.workAreasService.update(this.zoneId, payload));
      } else {
        await firstValueFrom(this.workAreasService.create(payload));
      }

      this.context.onSaved();
      this.dialogRef.close();
    } catch {
      this.formError.set('We could not save this work area. Please review the form and try again.');
    }
  }
}
