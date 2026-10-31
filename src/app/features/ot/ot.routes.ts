import { Routes } from '@angular/router';

export const OT_ROUTES: Routes = [
  {
    path: '',
    title: 'Operation theatre',
    loadComponent: () => import('./pages/ot-board-page').then((m) => m.OtBoardPage),
  },
  {
    path: 'cases',
    title: 'Operations',
    data: { breadcrumb: 'Operations' },
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/ot-cases-page').then((m) => m.OtCasesPage),
      },
      {
        path: ':id',
        title: 'Operation',
        data: { breadcrumb: 'Operation' },
        loadComponent: () => import('./pages/ot-case-detail-page').then((m) => m.OtCaseDetailPage),
      },
    ],
  },
  {
    path: 'setup',
    title: 'OT setup',
    data: { breadcrumb: 'Setup' },
    loadComponent: () => import('./pages/ot-setup-page').then((m) => m.OtSetupPage),
  },
];
