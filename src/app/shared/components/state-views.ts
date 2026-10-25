import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiError } from '../../core/http/api-error';
import { describeError } from '../../core/services/notification.service';

/** Centered spinner with an announced label, for whole-section loading. */
@Component({
  selector: 'app-loading-state',
  imports: [MatProgressSpinnerModule],
  template: `
    <div class="flex flex-col items-center justify-center gap-3 py-12" role="status" aria-live="polite">
      <mat-spinner diameter="36" aria-hidden="true" />
      <span class="text-sm text-on-surface-variant">{{ label() }}</span>
    </div>
  `,
})
export class LoadingState {
  readonly label = input('Loading…');
}

/** "Nothing here yet" placeholder with an optional call-to-action slot. */
@Component({
  selector: 'app-empty-state',
  imports: [MatIconModule],
  template: `
    <div class="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <mat-icon class="app-icon-xl text-on-surface-variant" aria-hidden="true">{{ icon() }}</mat-icon>
      <h2 class="text-lg font-medium">{{ title() }}</h2>
      @if (message()) {
        <p class="max-w-md text-sm text-on-surface-variant">{{ message() }}</p>
      }
      <div class="mt-2"><ng-content /></div>
    </div>
  `,
})
export class EmptyState {
  readonly icon = input('inbox');
  readonly title = input.required<string>();
  readonly message = input<string>();
}

/** Error panel with a retry button. Announced to screen readers when it appears. */
@Component({
  selector: 'app-error-state',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div
      class="flex flex-col items-center justify-center gap-2 rounded-card bg-error-container px-4 py-10 text-center text-on-error-container"
      role="alert"
    >
      <mat-icon aria-hidden="true">error</mat-icon>
      <h2 class="text-lg font-medium">{{ title() }}</h2>
      <p class="max-w-md text-sm">{{ message() }}</p>
      @if (retryable()) {
        <button matButton="outlined" class="mt-2" (click)="retry.emit()">
          <mat-icon>refresh</mat-icon>
          Try again
        </button>
      }
    </div>
  `,
})
export class ErrorState {
  readonly error = input.required<ApiError | string>();
  readonly title = input('Something went wrong');
  readonly retryable = input(true);
  readonly retry = output();

  protected readonly message = computed(() => {
    const error = this.error();
    return typeof error === 'string' ? error : describeError(error);
  });
}
