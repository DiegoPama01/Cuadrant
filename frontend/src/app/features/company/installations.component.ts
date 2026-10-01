import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { CompanyPermissionsService } from '../../core/company/company-permissions.service';
import { CompanyService } from '../../core/company/company.service';
import { InstallationsService } from '../../core/company/installations.service';

@Component({
  selector: 'app-installations',
  imports: [RouterLink, HlmAlertDialogImports, HlmBadgeImports, HlmButtonImports, HlmCardImports, HlmTableImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './installations.component.html',
})
export class InstallationsComponent {
  private readonly installationsService = inject(InstallationsService);
  private readonly companyService = inject(CompanyService);
  private readonly permissions = inject(CompanyPermissionsService);
  private readonly deletingIds = signal<Set<string>>(new Set());

  protected readonly installationsResource = resource({
    loader: async () => firstValueFrom(this.installationsService.listForActiveCompany()),
  });

  protected readonly installations = computed(() => this.installationsResource.value() ?? []);
  protected readonly activeInstallationId = computed(() => this.companyService.getActiveInstallationId());
  protected readonly canManage = computed(() => this.permissions.canManageInstallations());
  protected readonly isDeleting = (installationId: string) => this.deletingIds().has(installationId);
  protected readonly installationsError = computed(() => {
    const error = this.installationsResource.error();
    return error ? 'We could not load installations right now. Please try again.' : null;
  });

  protected reload(): void {
    void this.installationsResource.reload();
  }

  protected async deleteInstallation(installationId: string): Promise<void> {
    this.deletingIds.update((ids) => new Set(ids).add(installationId));

    try {
      await firstValueFrom(this.installationsService.delete(installationId));
      if (this.activeInstallationId() === installationId) {
        const nextInstallation = this.installations().find((installation) => installation.id !== installationId);
        this.companyService.setActiveInstallationId(nextInstallation?.id ?? null);
      }
      await this.installationsResource.reload();
    } finally {
      this.deletingIds.update((ids) => {
        const next = new Set(ids);
        next.delete(installationId);
        return next;
      });
    }
  }
}
