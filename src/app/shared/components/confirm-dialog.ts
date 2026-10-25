import { Component, inject, Injectable } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { map, Observable } from 'rxjs';

export interface ConfirmOptions {
  readonly title: string;
  readonly message: string;
  readonly confirmText?: string;
  readonly cancelText?: string;
  /** Styles the confirm button as a destructive action. */
  readonly destructive?: boolean;
}

/**
 * Confirmation for destructive or irreversible actions. MatDialog traps focus, restores it to the trigger
 * on close and labels the dialog by its title. Focus starts on Cancel so Enter never confirms by accident.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p class="max-w-prose">{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton [mat-dialog-close]="false" cdkFocusInitial>{{ data.cancelText ?? 'Cancel' }}</button>
      <button
        matButton="filled"
        [mat-dialog-close]="true"
        [class.app-danger-button]="data.destructive"
        data-testid="confirm-button"
      >
        {{ data.confirmText ?? 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmOptions>(MAT_DIALOG_DATA);
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog);

  /** Emits `true` only when the user explicitly confirms. */
  confirm(options: ConfirmOptions): Observable<boolean> {
    return this.dialog
      .open<ConfirmDialog, ConfirmOptions, boolean>(ConfirmDialog, {
        data: options,
        maxWidth: '28rem',
        role: 'alertdialog',
      })
      .afterClosed()
      .pipe(map((result) => result === true));
  }
}
