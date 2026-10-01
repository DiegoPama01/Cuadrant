import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { randomFormColor } from '../../shared/color-utils';
import { CompanyService } from '../../core/company/company.service';
import { ShiftsFormComponent } from './shifts-form.component';
import { ShiftUpsertPayload } from './shifts.model';
import { ShiftsService } from './shifts.service';

@Component({
  selector: 'app-shifts-form-page',
  imports: [ShiftsFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shifts-form-page.component.html',
})
export class ShiftsFormPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly shiftsService = inject(ShiftsService);
  private readonly companyService = inject(CompanyService);

  private readonly shiftId = this.route.snapshot.paramMap.get('id');
  protected readonly isEditMode = this.shiftId !== null;
  protected readonly formError = signal<string | null>(null);

  protected readonly shiftResource = resource({
    loader: async () => {
      if (!this.shiftId) {
        return null;
      }

      return firstValueFrom(this.shiftsService.get(this.shiftId));
    },
  });

  protected readonly initialValue = computed<ShiftUpsertPayload>(() => {
    const shift = this.shiftResource.value();

    if (!shift) {
      return {
        name: '',
        installation: this.companyService.getActiveInstallationId() ?? undefined,
        code: '',
        start_time: '',
        end_time: '',
        break_minutes: 0,
        color: randomFormColor(),
        sort_order: 0,
        active: true,
      };
    }

    return {
      installation: shift.installation ?? undefined,
      name: shift.name,
      code: shift.code ?? '',
      start_time: shift.start_time,
      end_time: shift.end_time,
      break_minutes: shift.break_minutes ?? 0,
      color: shift.color,
      sort_order: shift.sort_order ?? 0,
      active: shift.active ?? true,
    };
  });

  protected async saveShift(payload: ShiftUpsertPayload): Promise<void> {
    this.formError.set(null);

    try {
      if (this.shiftId) {
        await firstValueFrom(this.shiftsService.update(this.shiftId, payload));
      } else {
        await firstValueFrom(this.shiftsService.create(payload));
      }

      await this.router.navigate(['/settings/shifts']);
    } catch {
      this.formError.set('We could not save this shift. Please review the form and try again.');
    }
  }

}
