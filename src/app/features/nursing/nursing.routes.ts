import { Routes } from '@angular/router';
import { requirePermissions } from '../../core/guards/auth.guards';

export const NURSING_ROUTES: Routes = [
  {
    path: '',
    title: 'Observation rounds',
    loadComponent: () => import('./pages/observation-board-page').then((m) => m.ObservationBoardPage),
  },
  {
    path: 'admissions/:id',
    title: 'Nursing records',
    data: { breadcrumb: 'Nursing records' },
    loadComponent: () => import('./pages/stay-nursing-page').then((m) => m.StayNursingPage),
  },
  {
    path: 'rounds',
    title: 'Rounds',
    canMatch: [requirePermissions('rx:manage')],
    data: { breadcrumb: 'Rounds' },
    loadComponent: () => import('./pages/rounds-page').then((m) => m.RoundsPage),
  },
];
