import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api-config';

/** `GET /auth/sessions`. */
export interface AccountSession {
  readonly id: string;
  readonly createdAt: string;
  readonly lastUsedAt: string;
  readonly expiresAt: string;
  readonly userAgent: string | null;
  readonly ipAddress: string | null;
  /** The session making this request. */
  readonly current: boolean;
}

/** Self-service account endpoints for the signed-in user. */
@Injectable({ providedIn: 'root' })
export class AccountApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  updateProfile(displayName: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/users/me`, { displayName });
  }

  /** Other sessions are revoked by the backend; the current one stays signed in. */
  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/auth/change-password`, { currentPassword, newPassword });
  }

  sessions(): Observable<AccountSession[]> {
    return this.http.get<AccountSession[]>(`${this.baseUrl}/auth/sessions`);
  }

  revokeSession(sessionId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/auth/sessions/${encodeURIComponent(sessionId)}`);
  }

  logoutAll(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/auth/logout-all`, null, { withCredentials: true });
  }
}
