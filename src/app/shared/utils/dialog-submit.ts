import type { WritableSignal } from '@angular/core';
import type { MatDialogRef } from '@angular/material/dialog';
import { finalize, type Observable } from 'rxjs';
import { toApiError } from '../../core/http/api-error';
import { describeError } from '../../core/services/notification.service';

/**
 * Runs a dialog's request: the dialog cannot be closed meanwhile, closes with the result (true for none) on success,
 * and shows the backend's message on failure.
 */
export function submitDialog<T>(
  dialogRef: MatDialogRef<unknown, T | true>,
  state: { submitting: WritableSignal<boolean>; error: WritableSignal<string | null> },
  request: Observable<T>,
): void {
  if (state.submitting()) return;
  state.submitting.set(true);
  state.error.set(null);
  dialogRef.disableClose = true;
  request
    .pipe(
      finalize(() => {
        state.submitting.set(false);
        dialogRef.disableClose = false;
      }),
    )
    .subscribe({
      // A request with no answer closes with true, so the caller can tell it from closing without saving.
      next: (result) => dialogRef.close(result === undefined ? true : result),
      error: (error: unknown) => state.error.set(describeError(toApiError(error))),
    });
}
