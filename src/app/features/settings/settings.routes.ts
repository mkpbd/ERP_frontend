import { Routes } from '@angular/router';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    title: 'Account settings',
    loadComponent: () => import('./pages/settings-page').then((m) => m.SettingsPage),
  },
];
