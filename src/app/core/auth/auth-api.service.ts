import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api-config';
import { publicRequest } from '../http/http-context';
import type { CurrentUser, LoginRequest, MessageResponse, TokenResponse } from './auth.models';
import { CSRF_HEADER } from './cookies';

/** Data access for the backend's authentication endpoints. Holds no state. */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  login(request: LoginRequest): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.baseUrl}/auth/login`, request, {
      context: publicRequest(),
      withCredentials: true,
    });
  }

  /** Rotates the HttpOnly refresh cookie. The CSRF token must echo the `erp_csrf` cookie. */
  refresh(csrfToken: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(
      `${this.baseUrl}/auth/refresh`,
      {},
      {
        context: publicRequest(),
        withCredentials: true,
        headers: new HttpHeaders({ [CSRF_HEADER]: csrfToken }),
      },
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/auth/logout`, null, { withCredentials: true });
  }

  currentUser(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${this.baseUrl}/users/me`);
  }

  forgotPassword(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      `${this.baseUrl}/auth/forgot-password`,
      { email },
      { context: publicRequest() },
    );
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/auth/reset-password`,
      { token, newPassword },
      { context: publicRequest() },
    );
  }

  verifyEmail(token: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/auth/verify-email`, { token }, { context: publicRequest() });
  }

  resendVerification(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      `${this.baseUrl}/auth/resend-verification`,
      { email },
      { context: publicRequest() },
    );
  }
}
