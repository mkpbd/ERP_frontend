import { Routes } from '@angular/router';

export const IPD_ROUTES: Routes = [
  {
    path: '',
    title: 'Admissions',
    loadComponent: () => import('./pages/admissions-page').then((m) => m.AdmissionsPage),
  },
  {
    path: 'beds',
    title: 'Bed board',
    data: { breadcrumb: 'Bed board' },
    loadComponent: () => import('./pages/bed-board-page').then((m) => m.BedBoardPage),
  },
  {
    path: 'admissions/:id',
    title: 'Admission',
    data: { breadcrumb: 'Admission' },
    loadComponent: () => import('./pages/admission-page').then((m) => m.AdmissionPage),
  },
];
