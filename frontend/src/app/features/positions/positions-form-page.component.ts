import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { randomFormColor } from '../../shared/color-utils';
import { CompanyService } from '../../core/company/company.service';
import { PositionsFormComponent } from './positions-form.component';
import { PositionUpsertPayload } from './positions.model';
import { PositionsService } from './positions.service';

@Component({
  selector: 'app-positions-form-page',
  imports: [HlmButtonImports, PositionsFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './positions-form-page.component.html',
})
export class PositionsFormPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly positionsService = inject(PositionsService);
  private readonly companyService = inject(CompanyService);

  private readonly positionId = this.route.snapshot.paramMap.get('id');
  protected readonly isEditMode = this.positionId !== null;
  protected readonly formError = signal<string | null>(null);

  protected readonly positionResource = resource({
    loader: async () => {
      if (!this.positionId) {
        return null;
      }

      return firstValueFrom(this.positionsService.get(this.positionId));
    },
  });

  protected readonly initialValue = computed<PositionUpsertPayload>(() => {
    const position = this.positionResource.value();

    if (!position) {
      return {
        name: '',
        installation: this.companyService.getActiveInstallationId() ?? undefined,
        code: '',
        description: '',
        color: randomFormColor(),
        sort_order: 0,
        active: true,
      };
    }

    return {
      installation: position.installation ?? undefined,
      name: position.name,
      code: position.code ?? '',
      description: position.description ?? '',
      color: position.color,
      sort_order: position.sort_order ?? 0,
      active: position.active ?? true,
    };
  });

  protected async savePosition(payload: PositionUpsertPayload): Promise<void> {
    this.formError.set(null);

    try {
      if (this.positionId) {
        await firstValueFrom(this.positionsService.update(this.positionId, payload));
      } else {
        await firstValueFrom(this.positionsService.create(payload));
      }

      await this.router.navigate(['/settings/positions']);
    } catch {
      this.formError.set('We could not save this position. Please review the form and try again.');
    }
  }

}
