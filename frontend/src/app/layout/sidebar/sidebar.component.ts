import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideChevronsUpDown, lucideCommand } from '@ng-icons/lucide';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmSidebarImports } from '@spartan-ng/helm/sidebar';
import { InstallationSummary } from '../../core/company/installation.model';
import { data } from '../../shared/sidebar/data';
import { NavMain } from '../../shared/sidebar/nav-main';
import { NavUser } from '../../shared/sidebar/nav-user';

export interface SidebarUser {
  name: string;
  email: string;
  avatar: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [HlmSidebarImports, HlmDropdownMenuImports, NgIcon, NavMain, NavUser],
  providers: [provideIcons({ lucideCheck, lucideChevronsUpDown, lucideCommand })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  public readonly companyName = input('Acme Inc');
  public readonly companyPlan = input('Enterprise');
  public readonly installations = input<InstallationSummary[]>([]);
  public readonly activeInstallationId = input<string | null>(null);
  public readonly canManageCompany = input(false);
  public readonly user = input<SidebarUser>(data.user);
  public readonly installationSelected = output<string>();
  public readonly logoutRequested = output<void>();
  protected readonly data = data;
  protected readonly activeInstallationName = computed(() => {
    const activeInstallationId = this.activeInstallationId();

    if (!activeInstallationId) {
      return 'Select installation';
    }

    return this.installations().find((installation) => installation.id === activeInstallationId)?.name ?? 'Installation';
  });

  protected selectInstallation(installationId: string): void {
    this.installationSelected.emit(installationId);
  }

  protected requestLogout(): void {
    this.logoutRequested.emit();
  }
}
