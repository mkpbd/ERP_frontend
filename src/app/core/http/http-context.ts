import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * Marks a request that must not carry the access token or trigger a token refresh on 401
 * (login, refresh and the public account-recovery endpoints).
 */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

export function publicRequest(): HttpContext {
  return new HttpContext().set(SKIP_AUTH, true);
}
