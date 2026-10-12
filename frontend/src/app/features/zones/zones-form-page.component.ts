import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { randomFormColor } from '../../shared/color-utils';
import { ZonesFormComponent } from './zones-form.component';
import { WorkAreaUpsertPayload } from './zones.model';
import { WorkAreasService } from './zones.service';

@Component({
  selector: 'app-zones-form-page',
  imports: [ZonesFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './zones-form-page.component.html',
})
export class ZonesFormPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly workAreasService = inject(WorkAreasService);

  private readonly zoneId = this.route.snapshot.paramMap.get('id');
  protected readonly isEditMode = this.zoneId !== null;
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
        code: '',
        description: '',
        color: randomFormColor(),
        active: true,
      };
    }

    return {
      name: workArea.name,
      code: workArea.code ?? '',
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

      await this.router.navigate(['/settings/work-areas']);
    } catch {
      this.formError.set('We could not save this work area. Please review the form and try again.');
    }
  }

}
