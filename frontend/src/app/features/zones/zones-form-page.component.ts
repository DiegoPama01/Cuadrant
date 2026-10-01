import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { randomFormColor } from '../../shared/color-utils';
import { CompanyService } from '../../core/company/company.service';
import { ZonesFormComponent } from './zones-form.component';
import { ZoneUpsertPayload } from './zones.model';
import { ZonesService } from './zones.service';
import { ShiftsService } from '../shifts/shifts.service';
import { Shift } from '../shifts/shifts.model';
import { ShiftUpsertPayload } from '../shifts/shifts.model';
import { PositionsService } from '../positions/positions.service';
import { Position, PositionUpsertPayload } from '../positions/positions.model';

@Component({
  selector: 'app-zones-form-page',
  imports: [ZonesFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './zones-form-page.component.html',
})
export class ZonesFormPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly zonesService = inject(ZonesService);
  private readonly companyService = inject(CompanyService);
  private readonly shiftsService = inject(ShiftsService);
  private readonly positionsService = inject(PositionsService);
  protected readonly shiftsResource = resource({ loader: async () => firstValueFrom(this.shiftsService.list()) });
  protected readonly shifts = computed<Shift[]>(() => this.shiftsResource.value() ?? []);
  protected readonly positionsResource = resource({ loader: async () => firstValueFrom(this.positionsService.list()) });
  protected readonly positions = computed<Position[]>(() => this.positionsResource.value() ?? []);

  private readonly zoneId = this.route.snapshot.paramMap.get('id');
  protected readonly isEditMode = this.zoneId !== null;
  protected readonly formError = signal<string | null>(null);

  protected readonly zoneResource = resource({
    loader: async () => {
      if (!this.zoneId) {
        return null;
      }

      return firstValueFrom(this.zonesService.get(this.zoneId));
    },
  });

  protected readonly initialValue = computed<ZoneUpsertPayload>(() => {
    const zone = this.zoneResource.value();

    if (!zone) {
      return {
        name: '',
        installation: this.companyService.getActiveInstallationId() ?? undefined,
        code: '',
        description: '',
        color: randomFormColor(),
        sort_order: 0,
        active: true,
        staff_requirements: [],
      };
    }

    return {
      installation: zone.installation ?? undefined,
      name: zone.name,
      code: zone.code ?? '',
      description: zone.description ?? '',
      color: zone.color,
      sort_order: zone.sort_order ?? 0,
      active: zone.active ?? true,
      staff_requirements: zone.staff_requirements ?? [],
    };
  });

  protected async saveZone(payload: ZoneUpsertPayload): Promise<void> {
    this.formError.set(null);

    try {
      if (this.zoneId) {
        await firstValueFrom(this.zonesService.update(this.zoneId, payload));
      } else {
        await firstValueFrom(this.zonesService.create(payload));
      }

      await this.router.navigate(['/settings/zones']);
    } catch {
      this.formError.set('We could not save this zone. Please review the form and try again.');
    }
  }

  protected async createShift(payload: ShiftUpsertPayload): Promise<Shift> {
    return firstValueFrom(this.shiftsService.create(payload));
  }

  protected async createPosition(payload: PositionUpsertPayload): Promise<Position> {
    return firstValueFrom(this.positionsService.create(payload));
  }

}
