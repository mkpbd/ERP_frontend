import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { filter, Observable, switchMap } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog';
import { PageHeader } from '../../../shared/components/page-header';
import { ErrorState, LoadingState } from '../../../shared/components/state-views';
import { StatusBadge } from '../../../shared/components/status-badge';
import { CultureEntry } from '../components/culture-entry';
import { TextEntry, type TextRequest } from '../components/text-entry';
import { ValuesEntry, type ValuesRequest } from '../components/values-entry';
import { type CultureRequest, FORM_LABELS, RESULT_LABELS, RESULT_TONES } from '../models/lab.models';
import { LabResultStore } from '../state/lab-result.store';

/** One test's result: entered in its test's form, then verified by someone else. */
@Component({
  selector: 'app-lab-result-page',
  providers: [LabResultStore],
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    PageHeader,
    ErrorState,
    LoadingState,
    StatusBadge,
    CultureEntry,
    TextEntry,
    ValuesEntry,
  ],
  template: `
    @if (store.error(); as error) {
      <app-error-state
        [error]="error"
        [title]="error.status === 404 ? 'Result not found' : 'Could not load the result'"
        [retryable]="error.status !== 404"
        (retry)="store.reload()"
      />
    } @else if (store.result(); as result) {
      <app-page-header [title]="result.testName ?? 'Result'" [subtitle]="subtitle()">
        <app-status-badge [label]="statusLabels[result.status]" [tone]="statusTones[result.status]" />
        <a matButton="outlined" [routerLink]="['/lab/samples', result.sampleId]">
          <mat-icon>science</mat-icon>
          Sample {{ result.labNumber }}
        </a>
        @if (store.canVerify()) {
          <button matButton="filled" type="button" (click)="verify()" [disabled]="!!store.pending()">
            <mat-icon>verified</mat-icon>
            Verify
          </button>
        }
        @if (store.canUnverify()) {
          <button matButton="outlined" type="button" (click)="unverify()" [disabled]="!!store.pending()">
            <mat-icon>undo</mat-icon>
            Take back verification
          </button>
        }
      </app-page-header>

      <p class="mb-4 text-sm text-on-surface-variant">
        {{ formLabels[result.form] }}
        @if (result.enteredAt) {
          · entered {{ result.enteredAt | date: 'medium' }}
        }
        @if (result.verifiedAt) {
          · verified {{ result.verifiedAt | date: 'medium' }}
        }
        @if (result.status === 'pending' && !store.canEnter()) {
          · waiting to be entered
        }
      </p>

      @switch (result.form) {
        @case ('culture') {
          <app-culture-entry
            [result]="result"
            [editable]="store.canEnter()"
            [busy]="!!store.pending()"
            (save)="saveCulture($event)"
          />
        }
        @case ('descriptive') {
          <app-text-entry
            [result]="result"
            [editable]="store.canEnter()"
            [busy]="!!store.pending()"
            (save)="saveText($event)"
          />
        }
        @default {
          <app-values-entry
            [result]="result"
            [editable]="store.canEnter()"
            [busy]="!!store.pending()"
            (save)="saveValues($event)"
          />
        }
      }
    } @else if (store.loading()) {
      <app-loading-state label="Loading the result…" />
    }
  `,
})
export class LabResultPage {
  protected readonly store = inject(LabResultStore);
  private readonly confirm = inject(ConfirmService);
  private readonly notifications = inject(NotificationService);

  protected readonly statusLabels = RESULT_LABELS;
  protected readonly statusTones = RESULT_TONES;
  protected readonly formLabels = FORM_LABELS;
  protected readonly subtitle = computed(() => {
    const result = this.store.result();
    if (!result) return '';
    return [
      result.patientName,
      result.uhid ? `UHID ${result.uhid}` : null,
      result.labNumber,
      result.billNumber,
    ]
      .filter((part) => !!part)
      .join(' · ');
  });

  protected saveValues(request: ValuesRequest): void {
    this.saved(this.store.enterValues(request.values, request.comment));
  }

  protected saveCulture(request: CultureRequest): void {
    this.saved(this.store.enterCulture(request));
  }

  protected saveText(request: TextRequest): void {
    this.saved(this.store.enterText(request.narrative, request.comment));
  }

  private saved(request$: Observable<void>): void {
    request$.subscribe({
      next: () => this.notifications.success('Result saved. Someone else verifies it.'),
      error: (error: unknown) => this.notifications.error(error),
    });
  }

  protected verify(): void {
    this.confirm
      .confirm({
        title: 'Verify this result?',
        message:
          'It can then be printed and handed over. Only someone other than who entered it can verify it.',
        confirmText: 'Verify',
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.store.verify()),
      )
      .subscribe({
        next: () => this.notifications.success('Result verified.'),
        error: (error: unknown) => this.notifications.error(error),
      });
  }

  protected unverify(): void {
    this.confirm
      .confirm({
        title: 'Take the verification back?',
        message: 'The result can then be corrected and verified again. Not possible once handed over.',
        confirmText: 'Take back',
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.store.unverify()),
      )
      .subscribe({
        next: () => this.notifications.success('Verification taken back.'),
        error: (error: unknown) => this.notifications.error(error),
      });
  }
}
