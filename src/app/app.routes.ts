import { Routes } from '@angular/router';
import { authGuard, guestGuard, requirePermissions } from './core/guards/auth.guards';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/auth-layout/auth-layout').then((m) => m.AuthLayout),
    canActivate: [guestGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    // Email links land here whether or not the user is signed in.
    path: 'verify-email',
    loadComponent: () => import('./layout/auth-layout/auth-layout').then((m) => m.AuthLayout),
    children: [
      {
        path: '',
        title: 'Verify email',
        loadComponent: () => import('./features/auth/pages/verify-email-page').then((m) => m.VerifyEmailPage),
      },
    ],
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    canMatch: [authGuard],
    data: { breadcrumb: 'Home' },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'users',
        canMatch: [requirePermissions('users:read')],
        data: { breadcrumb: 'Users' },
        loadChildren: () => import('./features/users/users.routes').then((m) => m.USERS_ROUTES),
      },
      {
        path: 'roles',
        canMatch: [requirePermissions('roles:read')],
        data: { breadcrumb: 'Roles' },
        loadChildren: () => import('./features/roles/roles.routes').then((m) => m.ROLES_ROUTES),
      },
      {
        path: 'permissions',
        canMatch: [requirePermissions('permissions:read')],
        data: { breadcrumb: 'Permissions' },
        loadChildren: () =>
          import('./features/permissions/permissions.routes').then((m) => m.PERMISSIONS_ROUTES),
      },
      {
        path: 'ot',
        canMatch: [requirePermissions('ot:read')],
        data: { breadcrumb: 'Operation theatre' },
        loadChildren: () => import('./features/ot/ot.routes').then((m) => m.OT_ROUTES),
      },
      {
        path: 'lab',
        canMatch: [requirePermissions('lab:read')],
        data: { breadcrumb: 'Laboratory' },
        loadChildren: () => import('./features/lab/lab.routes').then((m) => m.LAB_ROUTES),
      },
      {
        path: 'audit',
        canMatch: [requirePermissions('audit:read')],
        data: { breadcrumb: 'Audit log' },
        loadChildren: () => import('./features/audit/audit.routes').then((m) => m.AUDIT_ROUTES),
      },
      {
        path: 'settings',
        data: { breadcrumb: 'Settings' },
        loadChildren: () => import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
      {
        path: 'forbidden',
        title: 'Access denied',
        loadComponent: () => import('./features/system/pages/forbidden-page').then((m) => m.ForbiddenPage),
      },
      {
        path: '**',
        title: 'Page not found',
        loadComponent: () => import('./features/system/pages/not-found-page').then((m) => m.NotFoundPage),
      },
    ],
  },
  // Anonymous visitors on an unknown URL: authGuard did not match, so send them to sign in.
  { path: '**', redirectTo: 'login' },
];
