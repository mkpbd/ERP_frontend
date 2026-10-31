import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { finalize } from 'rxjs';
import { toApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/services/notification.service';
import type { CollectableOrder } from '../models/lab.models';
import { LabApi } from '../services/lab-api.service';

/**
 * Old sample collection: the bill found by its number, then a sample with a lab number collected for one lab
 * department's tests not yet in work.
 */
@Component({
  selector: 'app-collect-dialog',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>Collect a sample</h2>
    <mat-dialog-content class="flex flex-col gap-3">
      <form [formGroup]="form" (ngSubmit)="find()" novalidate class="flex items-start gap-2">
        <mat-form-field class="flex-1">
          <mat-label>Bill number</mat-label>
          <input matInput formControlName="number" required cdkFocusInitial data-testid="collect-bill" />
        </mat-form-field>
        <button matButton="tonal" type="submit" class="mt-2" [disabled]="busy()">Find</button>
      </form>
      @if (error()) {
        <p class="rounded-card bg-error-container px-4 py-3 text-sm text-on-error-container" role="alert">
          {{ error() }}
        </p>
      }
      @if (order(); as order) {
        <div class="text-sm">
          <b>{{ order.patientName }}</b> · UHID {{ order.uhid }} · {{ order.billNumber }} ·
          {{ order.billedAt | date: 'medium' }}
        </div>
        @for (department of order.departments; track department.departmentId) {
          <section
            class="rounded-card border border-outline-variant p-3"
            [attr.aria-label]="department.departmentName"
          >
            <div class="mb-2 flex items-center justify-between gap-2">
              <h3 class="font-medium">{{ department.departmentName }}</h3>
              <button
                matButton="filled"
                type="button"
                [disabled]="busy() || waiting(department) === 0"
                (click)="collect(department.departmentId)"
              >
                Collect {{ waiting(department) }}
              </button>
            </div>
            <ul class="text-sm">
              @for (test of department.tests; track test.line) {
                <li [class.text-on-surface-variant]="test.inWork">
                  {{ test.testName }}
                  @if (test.inWork) {
                    <span>(collected already)</span>
                  }
                </li>
              }
            </ul>
          </section>
        } @empty {
          <p class="text-sm text-on-surface-variant">This bill has no lab tests.</p>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close [disabled]="busy()">Close</button>
    </mat-dialog-actions>
  `,
})
export class CollectDialog {
  private readonly api = inject(LabApi);
  private readonly dialogRef =
    inject<MatDialogRef<CollectDialog, { id: string; labNumber: string }>>(MatDialogRef);

  protected readonly form = new FormGroup({
    number: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly order = signal<CollectableOrder | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected waiting(department: CollectableOrder['departments'][number]): number {
    return department.tests.filter((test) => !test.inWork).length;
  }

  protected find(): void {
    const number = this.form.controls.number.value.trim();
    if (!number || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api
      .order(number)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (order) => this.order.set(order),
        error: (error: unknown) => {
          const apiError = toApiError(error);
          this.order.set(null);
          this.error.set(apiError.status === 404 ? 'No bill has this number.' : describeError(apiError));
        },
      });
  }

  protected collect(departmentId: string): void {
    const order = this.order();
    if (!order || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.dialogRef.disableClose = true;
    this.api
      .collect(order.billId, departmentId)
      .pipe(
        finalize(() => {
          this.busy.set(false);
          this.dialogRef.disableClose = false;
        }),
      )
      .subscribe({
        next: (collected) => this.dialogRef.close(collected),
        error: (error: unknown) => this.error.set(describeError(toApiError(error))),
      });
  }
}
