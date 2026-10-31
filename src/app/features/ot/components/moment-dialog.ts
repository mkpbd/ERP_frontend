import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize, Observable } from 'rxjs';
import { toApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/services/notification.service';

export interface MomentDialogData {
  readonly title: string;
  readonly message: string;
  readonly confirmText: string;
  readonly submit: (at: Date | null) => Observable<void>;
}

/** Starting or finishing an operation: now, or at the time it really happened. */
@Component({
  selector: 'app-moment-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content class="flex flex-col gap-3">
        <p class="max-w-prose">{{ data.message }}</p>
        @if (error()) {
          <p class="rounded-card bg-error-container px-4 py-3 text-sm text-on-error-container" role="alert">
            {{ error() }}
          </p>
        }
        <mat-form-field>
          <mat-label>When</mat-label>
          <input matInput type="datetime-local" formControlName="at" />
          <mat-hint>Leave empty for now.</mat-hint>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="submitting()">Back</button>
        <button matButton="filled" type="submit" [disabled]="submitting()" cdkFocusInitial>
          {{ data.confirmText }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class MomentDialog {
  protected readonly data = inject<MomentDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<MomentDialog, true>>(MatDialogRef);

  protected readonly at = new FormControl('', { nonNullable: true });
  protected readonly form = new FormGroup({ at: this.at });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.submitting()) return;
    // datetime-local is local wall-clock time without a zone; new Date() reads it as local.
    const at = this.at.value ? new Date(this.at.value) : null;
    this.submitting.set(true);
    this.error.set(null);
    this.dialogRef.disableClose = true;
    this.data
      .submit(at)
      .pipe(
        finalize(() => {
          this.submitting.set(false);
          this.dialogRef.disableClose = false;
        }),
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: (error: unknown) => this.error.set(describeError(toApiError(error))),
      });
  }
}
