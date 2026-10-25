import type { AppEnvironment } from './environment.model';

/**
 * Production defaults. Every value here ships to the browser: never put secrets in this file.
 * The API is expected on the same origin (reverse proxy routes /api to the backend), which keeps the
 * SameSite=Strict refresh cookie working without CORS.
 */
export const environment: AppEnvironment = {
  production: true,
  apiBaseUrl: '/api/v1',
};
