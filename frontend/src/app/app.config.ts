import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import {
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideSpartanHlm } from '@spartan-ng/helm/utils';

import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { authInterceptor } from './core/auth/auth.interceptor';
import { RuntimeConfigService } from './core/config/runtime-config.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(() => inject(RuntimeConfigService).load()),
    provideAppInitializer(() => inject(AuthService).syncSession()),
    provideRouter(routes),
    provideSpartanHlm(),
    provideHttpClient(
      withInterceptors([
        authInterceptor,
      ]),
    ),
  ],
};
