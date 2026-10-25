import type { AppEnvironment } from './environment.model';

/** Development: `ng serve` proxies /api to http://localhost:3000 (see proxy.conf.json). */
export const environment: AppEnvironment = {
  production: false,
  apiBaseUrl: '/api/v1',
};
