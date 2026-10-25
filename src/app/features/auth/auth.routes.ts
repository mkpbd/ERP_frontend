import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    title: 'Sign in',
    loadComponent: () => import('./pages/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'forgot-password',
    title: 'Forgot password',
    loadComponent: () => import('./pages/forgot-password-page').then((m) => m.ForgotPasswordPage),
  },
  {
    path: 'reset-password',
    title: 'Reset password',
    loadComponent: () => import('./pages/reset-password-page').then((m) => m.ResetPasswordPage),
  },
];
