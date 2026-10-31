import { Routes } from '@angular/router';
import { requireAnyPermission, requirePermissions } from '../../core/guards/auth.guards';

export const DIAGNOSTIC_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'appointments' },
  {
    path: 'appointments',
    title: 'Test appointments',
    canMatch: [requirePermissions('diag:read')],
    data: { breadcrumb: 'Test appointments' },
    loadComponent: () => import('./pages/appointments-page').then((m) => m.AppointmentsPage),
  },
  {
    path: 'home-collections',
    title: 'Home collections',
    canMatch: [requireAnyPermission('diag:read', 'diag:collect')],
    data: { breadcrumb: 'Home collections' },
    loadComponent: () => import('./pages/home-collections-page').then((m) => m.HomeCollectionsPage),
  },
  {
    path: 'setup',
    title: 'Booking setup',
    canMatch: [requirePermissions('diag:read')],
    data: { breadcrumb: 'Booking setup' },
    loadComponent: () => import('./pages/booking-setup-page').then((m) => m.BookingSetupPage),
  },
];
