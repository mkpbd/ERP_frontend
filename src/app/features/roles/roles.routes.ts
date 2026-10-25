import { Routes } from '@angular/router';

export const ROLES_ROUTES: Routes = [
  {
    path: '',
    title: 'Roles',
    loadComponent: () => import('./pages/roles-list-page').then((m) => m.RolesListPage),
  },
  {
    path: ':id',
    title: 'Role details',
    data: { breadcrumb: 'Role details' },
    loadComponent: () => import('./pages/role-detail-page').then((m) => m.RoleDetailPage),
  },
];
