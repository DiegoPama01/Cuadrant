import { Injectable, signal, WritableSignal } from '@angular/core';
import { CompanyMembership, User } from './auth.model';

interface PersistedAuthContext {
  currentUser: User | null;
  activeCompany: CompanyMembership | null;
  activeInstallationId: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class AuthContextService {
  private readonly storageKey = 'planning_app.auth_context';

  readonly currentUser: WritableSignal<User | null> = signal<User | null>(null);
  readonly activeCompany: WritableSignal<CompanyMembership | null> = signal<CompanyMembership | null>(null);
  readonly activeInstallationId: WritableSignal<string | null> = signal<string | null>(null);

  hydrate(): void {
    const persistedContext = this.readPersistedContext();

    if (!persistedContext) {
      return;
    }

    this.currentUser.set(persistedContext.currentUser);
    this.activeCompany.set(persistedContext.activeCompany);
    this.activeInstallationId.set(persistedContext.activeInstallationId);
  }

  setSession(user: User, activeCompany?: CompanyMembership | null): void {
    const resolvedCompany = activeCompany ?? user.companies[0] ?? null;

    this.currentUser.set(user);
    this.activeCompany.set(resolvedCompany);
    this.activeInstallationId.set(null);
    this.persist();
  }

  setActiveCompany(company: CompanyMembership | null): void {
    this.activeCompany.set(company);
    this.activeInstallationId.set(null);
    this.persist();
  }

  setActiveInstallationId(installationId: string | null): void {
    this.activeInstallationId.set(installationId);
    this.persist();
  }

  clear(): void {
    this.currentUser.set(null);
    this.activeCompany.set(null);
    this.activeInstallationId.set(null);
    localStorage.removeItem(this.storageKey);
  }

  private persist(): void {
    const payload: PersistedAuthContext = {
      currentUser: this.currentUser(),
      activeCompany: this.activeCompany(),
      activeInstallationId: this.activeInstallationId(),
    };

    localStorage.setItem(this.storageKey, JSON.stringify(payload));
  }

  private readPersistedContext(): PersistedAuthContext | null {
    const rawValue = localStorage.getItem(this.storageKey);

    if (!rawValue) {
      return null;
    }

    try {
      const parsedValue = JSON.parse(rawValue) as Partial<PersistedAuthContext>;

      return {
        currentUser: parsedValue.currentUser ?? null,
        activeCompany: parsedValue.activeCompany ?? null,
        activeInstallationId: parsedValue.activeInstallationId ?? null,
      };
    } catch {
      localStorage.removeItem(this.storageKey);
      return null;
    }
  }
}
