import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';
import { toApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/services/notification.service';
import type { HomeCollection } from '../models/diagnostic.models';
import { DiagnosticApi } from '../services/diagnostic-api.service';

/** A collector sent to the visit (one who takes samples at homes), or another instead. */
@Component({
  selector: 'app-assign-collector-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>Collector for {{ data.number }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        @if (error()) {
          <p
            class="mb-3 rounded-card bg-error-container px-4 py-3 text-sm text-on-error-container"
            role="alert"
          >
            {{ error() }}
          </p>
        }
        <p class="mb-3 text-sm text-on-surface-variant">
          {{ data.patientName }} · {{ data.areaName }} · {{ data.windowLabel }}
        </p>
        <mat-form-field class="w-full">
          <mat-label>Collector</mat-label>
          <mat-select [formControl]="collectorId" required data-testid="collector-select">
            @for (collector of collectorList(); track collector.id) {
              <mat-option [value]="collector.id">{{ collector.label }}</mat-option>
            }
          </mat-select>
          @if (!collectors.isLoading() && collectorList().length === 0) {
            <mat-hint>No one takes samples at homes yet: give a role diag:collect.</mat-hint>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="submitting()">Cancel</button>
        <button matButton="filled" type="submit" [disabled]="submitting()" data-testid="collector-submit">
          Send
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class AssignCollectorDialog {
  protected readonly data = inject<HomeCollection>(MAT_DIALOG_DATA);
  private readonly api = inject(DiagnosticApi);
  private readonly dialogRef = inject<MatDialogRef<AssignCollectorDialog, true>>(MatDialogRef);

  protected readonly collectors = rxResource({ stream: () => this.api.collectors() });
  protected readonly collectorList = computed(() =>
    this.collectors.hasValue() ? this.collectors.value() : [],
  );
  protected readonly collectorId = new FormControl<string | null>(this.data.collectorId, Validators.required);
  protected readonly form = new FormGroup({ collectorId: this.collectorId });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.submitting()) return;
    if (this.collectorId.invalid) {
      this.collectorId.markAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.api
      .assign(this.data.id, this.data.version, this.collectorId.value!)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: (error: unknown) => this.error.set(describeError(toApiError(error))),
      });
  }
}
