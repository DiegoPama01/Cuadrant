import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { CompanyPermissionsService } from '../../core/company/company-permissions.service';
import { InstallationsService } from '../../core/company/installations.service';
import { InstallationUpsertPayload } from '../../core/company/installation.model';

interface InstallationFormModel {
  name: string;
  code: string;
  address: string;
  timezone: string;
  active: boolean;
}

@Component({
  selector: 'app-installation-form-page',
  imports: [FormRoot, FormField, HlmButtonImports, HlmCardImports, HlmFieldImports, HlmInputImports, HlmSwitchImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './installation-form-page.component.html',
})
export class InstallationFormPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly installationsService = inject(InstallationsService);
  protected readonly permissions = inject(CompanyPermissionsService);
  private readonly installationId = this.route.snapshot.paramMap.get('id');

  protected readonly isEditMode = this.installationId !== null;
  protected readonly formError = signal<string | null>(null);
  protected readonly model = signal<InstallationFormModel>({ name: '', code: '', address: '', timezone: '', active: true });

  protected readonly installationResource = resource({
    loader: async () => {
      if (!this.installationId) {
        return null;
      }
      const installation = await firstValueFrom(this.installationsService.get(this.installationId));
      this.model.set({
        name: installation.name,
        code: installation.code ?? '',
        address: installation.address ?? '',
        timezone: installation.timezone ?? '',
        active: installation.active ?? true,
      });
      return installation;
    },
  });

  protected readonly title = computed(() => this.isEditMode ? 'Edit installation' : 'New installation');
  protected readonly canManage = computed(() => this.permissions.canManageInstallations());

  protected readonly installationForm = form(
    this.model,
    (schema) => {
      required(schema.name, { message: 'Name is required.' });
    },
    {
      submission: {
        action: async () => this.save(),
      },
    },
  );

  protected updateActive(active: boolean): void {
    this.model.update((value) => ({ ...value, active }));
  }

  protected async cancel(): Promise<void> {
    await this.router.navigate(['/settings/installations']);
  }

  private async save(): Promise<void> {
    if (!this.canManage()) {
      this.formError.set('You do not have permission to manage installations.');
      return;
    }

    this.formError.set(null);
    const payload = this.normalizePayload(this.model());

    try {
      if (this.installationId) {
        await firstValueFrom(this.installationsService.update(this.installationId, payload));
      } else {
        await firstValueFrom(this.installationsService.create(payload));
      }
      await this.router.navigate(['/settings/installations']);
    } catch {
      this.formError.set('We could not save this installation. Please review the form and try again.');
    }
  }

  private normalizePayload(value: InstallationFormModel): InstallationUpsertPayload {
    return {
      ...value,
      code: value.code?.trim() || null,
      address: value.address?.trim() || null,
      timezone: value.timezone?.trim() || null,
    };
  }
}
