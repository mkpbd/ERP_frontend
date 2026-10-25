import { Routes } from '@angular/router';

export const USERS_ROUTES: Routes = [
  {
    path: '',
    title: 'Users',
    loadComponent: () => import('./pages/users-list-page').then((m) => m.UsersListPage),
  },
  {
    path: ':id',
    title: 'User details',
    data: { breadcrumb: 'User details' },
    loadComponent: () => import('./pages/user-detail-page').then((m) => m.UserDetailPage),
  },
];
