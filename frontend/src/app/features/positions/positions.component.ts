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
import { JobRolesService } from '../job-roles/job-roles.service';
import { JobRoleDialogContext, PositionsFormPageComponent } from './positions-form-page.component';

@Component({
  selector: 'app-positions',
  imports: [
    HlmAlertDialogImports,
    HlmButtonImports,
    HlmCardImports,
    HlmTableImports,
    HlmTooltipImports,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './positions.component.html',
})
export class PositionsComponent {
  private readonly jobRolesService = inject(JobRolesService);
  private readonly dialog = inject(HlmDialogService);
  private readonly deletingIds = signal<Set<string>>(new Set());

  protected readonly jobRolesResource = resource({
    loader: async () => firstValueFrom(this.jobRolesService.list()),
  });

  protected readonly jobRoles = computed(() => this.jobRolesResource.value() ?? []);
  protected readonly isDeleting = (positionId: string) => this.deletingIds().has(positionId);
  protected readonly jobRolesError = computed(() => {
    const error = this.jobRolesResource.error();

    if (!error) {
      return null;
    }

    return error instanceof Error
      ? error.message
      : 'We could not load job roles right now. Please try again.';
  });

  protected reload(): void {
    void this.jobRolesResource.reload();
  }

  protected openJobRoleForm(jobRoleId?: string): void {
    this.dialog.open<unknown, JobRoleDialogContext>(PositionsFormPageComponent, {
      contentClass: 'max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl',
      context: {
        jobRoleId,
        onSaved: () => this.reload(),
      },
    });
  }

  protected async deleteJobRole(jobRoleId: string): Promise<void> {
    this.deletingIds.update((ids) => new Set(ids).add(jobRoleId));

    try {
      await firstValueFrom(this.jobRolesService.delete(jobRoleId));
      await this.jobRolesResource.reload();
    } finally {
      this.deletingIds.update((ids) => {
        const next = new Set(ids);
        next.delete(jobRoleId);
        return next;
      });
    }
  }
}
