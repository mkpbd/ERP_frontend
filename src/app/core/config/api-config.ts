import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Base URL of the versioned backend API (for example `/api/v1`), without a trailing slash. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl.replace(/\/+$/, ''),
});

/** True when `url` targets the backend API (only those requests get auth headers and correlation ids). */
export function isApiUrl(url: string, apiBaseUrl: string): boolean {
  return url === apiBaseUrl || url.startsWith(`${apiBaseUrl}/`);
}
