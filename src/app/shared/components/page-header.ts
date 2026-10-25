import { Component, input } from '@angular/core';

/** Page title, optional description and an actions slot: `<app-page-header title="Users">…buttons…</app-page-header>`. */
@Component({
  selector: 'app-page-header',
  template: `
    <header class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <h1 class="text-2xl font-normal text-on-surface">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="mt-1 text-sm text-on-surface-variant">{{ subtitle() }}</p>
        }
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <ng-content />
      </div>
    </header>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
