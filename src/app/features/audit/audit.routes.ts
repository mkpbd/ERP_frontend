import { Routes } from '@angular/router';

export const AUDIT_ROUTES: Routes = [
  {
    path: '',
    title: 'Audit log',
    loadComponent: () => import('./pages/audit-log-page').then((m) => m.AuditLogPage),
  },
];
