import { Routes } from '@angular/router';

export const PERMISSIONS_ROUTES: Routes = [
  {
    path: '',
    title: 'Permissions',
    loadComponent: () => import('./pages/permissions-page').then((m) => m.PermissionsPage),
  },
];
