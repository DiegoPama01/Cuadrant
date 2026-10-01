import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class CompanyPermissionsService {
  private readonly authService = inject(AuthService);

  canManageCompany(): boolean {
    return this.hasCompanyPermission('can_manage_company') || this.hasCompanyRole(['owner', 'admin']);
  }

  canCreateInstallation(): boolean {
    return this.hasCompanyPermission('can_create_installation') || this.hasCompanyRole(['owner', 'admin']);
  }

  canManageInstallations(): boolean {
    return this.canManageCompany() || this.canCreateInstallation();
  }

  private hasCompanyPermission(permission: string): boolean {
    // TODO: Replace this fallback when backend exposes effective OpenFGA permissions consistently.
    return this.authService.activeCompany()?.permissions?.includes(permission) ?? false;
  }

  private hasCompanyRole(roles: string[]): boolean {
    const role = this.authService.activeCompany()?.role;
    return role ? roles.includes(role) : false;
  }
}
