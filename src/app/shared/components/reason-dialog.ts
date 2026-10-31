import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize, Observable } from 'rxjs';
import { toApiError } from '../../core/http/api-error';
import { describeError } from '../../core/services/notification.service';
import { ValidationMessagePipe } from '../pipes/validation-message.pipe';

export interface ReasonDialogData {
  readonly title: string;
  readonly message: string;
  readonly confirmText: string;
  /** The field's label (default Reason). */
  readonly label?: string;
  /** Styles the confirm button as a destructive action (default true). */
  readonly destructive?: boolean;
  /** The words may be left out (a note); submitted as an empty text. */
  readonly optional?: boolean;
  readonly submit: (reason: string) => Observable<void>;
}

/** An action that needs a few words: a reason (cancelling, rejecting) or a name (who collected a report). */
@Component({
  selector: 'app-reason-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ValidationMessagePipe,
  ],
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
          <mat-label>{{ data.label ?? 'Reason' }}</mat-label>
          <textarea
            matInput
            formControlName="reason"
            rows="2"
            [required]="!data.optional"
            cdkFocusInitial
          ></textarea>
          <mat-error>{{ reason.errors | validationMessage: data.label ?? 'Reason' }}</mat-error>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="submitting()">Back</button>
        <button
          matButton="filled"
          type="submit"
          [class.app-danger-button]="data.destructive ?? true"
          [disabled]="submitting()"
        >
          {{ data.confirmText }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class ReasonDialog {
  protected readonly data = inject<ReasonDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ReasonDialog, true>>(MatDialogRef);

  protected readonly reason = new FormControl('', {
    nonNullable: true,
    validators: this.data.optional
      ? [Validators.maxLength(300)]
      : [Validators.required, Validators.maxLength(300)],
  });
  protected readonly form = new FormGroup({ reason: this.reason });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.submitting()) return;
    const reason = this.reason.value.trim();
    if (!reason && !this.data.optional) {
      this.reason.setValue('');
      this.reason.markAsTouched();
      return;
    }
    if (this.reason.invalid) return;
    this.submitting.set(true);
    this.error.set(null);
    this.dialogRef.disableClose = true;
    this.data
      .submit(reason)
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
