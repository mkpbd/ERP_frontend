import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

/** One number with a label. `value` is `null` while loading and `undefined` on error. */
@Component({
  selector: 'app-stat-card',
  imports: [MatIconModule, RouterLink],
  template: `
    <a
      [routerLink]="link()"
      class="app-card flex items-center gap-4 p-5 transition-colors hover:bg-surface-container"
    >
      <span
        class="grid h-12 w-12 place-items-center rounded-card bg-primary-container text-on-primary-container"
        aria-hidden="true"
      >
        <mat-icon>{{ icon() }}</mat-icon>
      </span>
      <span class="flex flex-col">
        <span class="text-sm text-on-surface-variant">{{ label() }}</span>
        <span class="text-2xl font-medium tabular-nums" aria-live="polite">
          @if (value() === null) {
            <span
              class="inline-block h-7 w-12 animate-pulse rounded bg-surface-container-high"
              aria-hidden="true"
            ></span>
            <span class="app-sr-only">Loading</span>
          } @else if (value() === undefined) {
            <span class="text-base text-on-surface-variant">Unavailable</span>
          } @else {
            {{ value() }}
          }
        </span>
      </span>
    </a>
  `,
})
export class StatCard {
  readonly label = input.required<string>();
  readonly icon = input.required<string>();
  readonly link = input.required<string>();
  readonly value = input<number | null | undefined>(null);
}
