import { Routes } from '@angular/router';

export const LAB_ROUTES: Routes = [
  {
    path: '',
    title: 'Lab worklist',
    loadComponent: () => import('./pages/lab-worklist-page').then((m) => m.LabWorklistPage),
  },
  {
    path: 'samples',
    title: 'Lab samples',
    data: { breadcrumb: 'Samples' },
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/lab-samples-page').then((m) => m.LabSamplesPage),
      },
      {
        path: ':id',
        title: 'Sample',
        data: { breadcrumb: 'Sample' },
        loadComponent: () => import('./pages/lab-sample-page').then((m) => m.LabSamplePage),
      },
    ],
  },
  {
    path: 'results/:id',
    title: 'Lab result',
    data: { breadcrumb: 'Result' },
    loadComponent: () => import('./pages/lab-result-page').then((m) => m.LabResultPage),
  },
  {
    path: 'setup',
    title: 'Lab setup',
    data: { breadcrumb: 'Setup' },
    loadComponent: () => import('./pages/lab-setup-page').then((m) => m.LabSetupPage),
  },
];
