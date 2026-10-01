import { routes } from './app.routes';

describe('application routes', () => {
  it('protects the planning area and keeps authentication pages for guests', () => {
    const loginRoute = routes.find((route) => route.path === 'login');
    const signupRoute = routes.find((route) => route.path === 'signup');
    const protectedRoute = routes.find((route) => route.path === '');

    expect(loginRoute?.canActivate).toHaveLength(1);
    expect(signupRoute?.canActivate).toHaveLength(1);
    expect(protectedRoute?.canActivate).toHaveLength(1);
    expect(protectedRoute?.children?.find((route) => route.path === 'planning')?.loadComponent).toBeTypeOf('function');
  });

  it('defines the main planning resources and the default redirect', () => {
    const protectedChildren = routes.find((route) => route.path === '')?.children ?? [];
    const settings = protectedChildren.find((route) => route.path === 'settings');
    const settingsChildren = settings?.children ?? [];

    expect(protectedChildren.find((route) => route.path === '')).toMatchObject({
      pathMatch: 'full',
      redirectTo: 'planning',
    });
    expect(settingsChildren.map((route) => route.path)).toEqual([
      'company',
      'installations',
      'positions',
      'zones',
      'shifts',
    ]);
  });
});
