import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { randomFormColor } from '../../shared/color-utils';
import { PositionsFormComponent } from './positions-form.component';
import { JobRoleUpsertPayload } from '../job-roles/job-roles.model';
import { JobRolesService } from '../job-roles/job-roles.service';

@Component({
  selector: 'app-positions-form-page',
  imports: [HlmButtonImports, PositionsFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './positions-form-page.component.html',
})
export class PositionsFormPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly jobRolesService = inject(JobRolesService);

  private readonly positionId = this.route.snapshot.paramMap.get('id');
  protected readonly isEditMode = this.positionId !== null;
  protected readonly formError = signal<string | null>(null);

  protected readonly positionResource = resource({
    loader: async () => {
      if (!this.positionId) {
        return null;
      }

       return firstValueFrom(this.jobRolesService.get(this.positionId));
    },
  });

  protected readonly initialValue = computed<JobRoleUpsertPayload>(() => {
    const position = this.positionResource.value();

    if (!position) {
      return {
        name: '',
        code: '',
        description: '',
        color: randomFormColor(),
        active: true,
      };
    }

    return {
      name: position.name,
      code: position.code ?? '',
      description: position.description ?? '',
      color: position.color,
      active: position.active,
    };
  });

  protected async saveJobRole(payload: JobRoleUpsertPayload): Promise<void> {
    this.formError.set(null);

    try {
      if (this.positionId) {
        await firstValueFrom(this.jobRolesService.update(this.positionId, payload));
      } else {
        await firstValueFrom(this.jobRolesService.create(payload));
      }

      await this.router.navigate(['/settings/job-roles']);
    } catch {
      this.formError.set('We could not save this job role. Please review the form and try again.');
    }
  }

}
