import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { CompanyPermissionsService } from '../../core/company/company-permissions.service';
import { CompanyService } from '../../core/company/company.service';
import { CompanyUpsertPayload } from '../../core/company/company.model';

interface CompanyFormModel {
  name: string;
  legal_name: string;
  tax_id: string;
  timezone: string;
  active: boolean;
}

@Component({
  selector: 'app-company-settings',
  imports: [FormRoot, FormField, HlmButtonImports, HlmCardImports, HlmFieldImports, HlmInputImports, HlmSwitchImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './company-settings.component.html',
})
export class CompanySettingsComponent {
  private readonly companyService = inject(CompanyService);
  protected readonly permissions = inject(CompanyPermissionsService);
  protected readonly formError = signal<string | null>(null);
  protected readonly formSuccess = signal<string | null>(null);
  protected readonly model = signal<CompanyFormModel>({ name: '', legal_name: '', tax_id: '', timezone: '', active: true });

  protected readonly companyResource = resource({
    loader: async () => {
      const companyId = this.companyService.getRequiredCompanyId();
      const company = await firstValueFrom(this.companyService.get(companyId));
      this.model.set({
        name: company.name,
        legal_name: company.legal_name ?? '',
        tax_id: company.tax_id ?? '',
        timezone: company.timezone ?? '',
        active: company.active ?? true,
      });
      return company;
    },
  });

  protected readonly companyForm = form(
    this.model,
    (schema) => {
      required(schema.name, { message: 'Name is required.' });
    },
    {
      submission: { action: async () => this.save() },
    },
  );

  protected canManage(): boolean {
    return this.permissions.canManageCompany();
  }

  protected updateActive(active: boolean): void {
    this.model.update((value) => ({ ...value, active }));
  }

  private async save(): Promise<void> {
    if (!this.canManage()) {
      this.formError.set('You do not have permission to manage this company.');
      return;
    }

    this.formError.set(null);
    this.formSuccess.set(null);

    try {
      await firstValueFrom(this.companyService.update(this.companyService.getRequiredCompanyId(), this.normalizePayload(this.model())));
      this.formSuccess.set('Company updated.');
      await this.companyResource.reload();
    } catch {
      this.formError.set('We could not save this company. Please review the form and try again.');
    }
  }

  private normalizePayload(value: CompanyFormModel): CompanyUpsertPayload {
    return {
      ...value,
      legal_name: value.legal_name?.trim() || null,
      tax_id: value.tax_id?.trim() || null,
      timezone: value.timezone?.trim() || null,
    };
  }
}
