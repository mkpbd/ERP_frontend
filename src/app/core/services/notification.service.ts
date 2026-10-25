import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiError, toApiError } from '../http/api-error';

/**
 * Transient, non-blocking messages. MatSnackBar announces them through a live region, so screen readers
 * hear them too. Errors stay longer and are announced assertively.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.snackBar.open(message, 'Dismiss', { duration: 4000, politeness: 'polite' });
  }

  info(message: string): void {
    this.snackBar.open(message, 'Dismiss', { duration: 5000, politeness: 'polite' });
  }

  error(error: string | ApiError | unknown): void {
    const message = typeof error === 'string' ? error : describeError(toApiError(error));
    this.snackBar.open(message, 'Dismiss', {
      duration: 8000,
      politeness: 'assertive',
      panelClass: 'app-snackbar-error',
    });
  }
}

/** User-facing text for an error; adds the request id for server faults so support can find the log line. */
export function describeError(error: ApiError): string {
  return error.isServerError && error.requestId
    ? `${error.message} (Ref: ${error.requestId})`
    : error.message;
}
