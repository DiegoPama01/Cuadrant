import { Routes } from '@angular/router';
import LoginPage from './features/auth/login/login.component';
import OidcCallbackPage from './features/auth/oidc-callback/oidc-callback.component';
import SignupPage from './features/auth/signup/signup.component';
import { MainLayoutComponent } from './layout/main-layout.component';
import { authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginPage,
    canActivate: [guestGuard],
  },
  {
    path: 'signup',
    component: SignupPage,
    canActivate: [guestGuard],
  },
  {
    path: 'auth/callback',
    component: OidcCallbackPage,
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'planning',
        data: {
          breadcrumb: 'Planning',
        },
        loadComponent: () =>
          import('./features/planning/planning.component').then((m) => m.PlanningComponent),
      },
      {
        path: 'employees',
        data: {
          breadcrumb: 'Employees',
        },
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () =>
              import('./features/employees/employees.component').then((m) => m.EmployeesComponent),
          },
          {
            path: 'new',
            data: {
              breadcrumb: 'New',
            },
            loadComponent: () =>
              import('./features/employees/employees-form-page.component').then(
                (m) => m.EmployeesFormPageComponent,
              ),
          },
          {
            path: ':id/edit',
            data: {
              breadcrumb: 'Edit',
            },
            loadComponent: () =>
              import('./features/employees/employees-form-page.component').then(
                (m) => m.EmployeesFormPageComponent,
              ),
          },
        ],
      },
      {
        path: 'settings',
        data: {
          breadcrumb: 'Settings',
        },
        children: [
          {
            path: 'company',
            data: {
              breadcrumb: 'Company',
            },
            loadComponent: () =>
              import('./features/company/company-settings.component').then(
                (m) => m.CompanySettingsComponent,
              ),
          },
          {
            path: 'installations',
            data: {
              breadcrumb: 'Installations',
            },
            children: [
              {
                path: '',
                pathMatch: 'full',
                loadComponent: () =>
                  import('./features/company/installations.component').then(
                    (m) => m.InstallationsComponent,
                  ),
              },
              {
                path: 'new',
                data: {
                  breadcrumb: 'New',
                },
                loadComponent: () =>
                  import('./features/company/installation-form-page.component').then(
                    (m) => m.InstallationFormPageComponent,
                  ),
              },
              {
                path: ':id/edit',
                data: {
                  breadcrumb: 'Edit',
                },
                loadComponent: () =>
                  import('./features/company/installation-form-page.component').then(
                    (m) => m.InstallationFormPageComponent,
                  ),
              },
            ],
          },
          {
            path: 'positions',
            data: {
              breadcrumb: 'Positions',
            },
            children: [
              {
                path: '',
                pathMatch: 'full',
                loadComponent: () =>
                  import('./features/positions/positions.component').then((m) => m.PositionsComponent),
              },
              {
                path: 'new',
                data: {
                  breadcrumb: 'New',
                },
                loadComponent: () =>
                  import('./features/positions/positions-form-page.component').then(
                    (m) => m.PositionsFormPageComponent,
                  ),
              },
              {
                path: ':id/edit',
                data: {
                  breadcrumb: 'Edit',
                },
                loadComponent: () =>
                  import('./features/positions/positions-form-page.component').then(
                    (m) => m.PositionsFormPageComponent,
                  ),
              },
            ],
          },
          {
            path: 'zones',
            data: {
              breadcrumb: 'Zones',
            },
            children: [
              {
                path: '',
                pathMatch: 'full',
                loadComponent: () =>
                  import('./features/zones/zones.component').then((m) => m.ZonesComponent),
              },
              {
                path: 'new',
                data: {
                  breadcrumb: 'New',
                },
                loadComponent: () =>
                  import('./features/zones/zones-form-page.component').then(
                    (m) => m.ZonesFormPageComponent,
                  ),
              },
              {
                path: ':id/edit',
                data: {
                  breadcrumb: 'Edit',
                },
                loadComponent: () =>
                  import('./features/zones/zones-form-page.component').then(
                    (m) => m.ZonesFormPageComponent,
                  ),
              },
            ],
          },
          {
            path: 'shifts',
            data: {
              breadcrumb: 'Shifts',
            },
            children: [
              {
                path: '',
                pathMatch: 'full',
                loadComponent: () =>
                  import('./features/shifts/shifts.component').then((m) => m.ShiftsComponent),
              },
              {
                path: 'new',
                data: {
                  breadcrumb: 'New',
                },
                loadComponent: () =>
                  import('./features/shifts/shifts-form-page.component').then(
                    (m) => m.ShiftsFormPageComponent,
                  ),
              },
              {
                path: ':id/edit',
                data: {
                  breadcrumb: 'Edit',
                },
                loadComponent: () =>
                  import('./features/shifts/shifts-form-page.component').then(
                    (m) => m.ShiftsFormPageComponent,
                  ),
              },
            ],
          },
        ],
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'planning',
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
