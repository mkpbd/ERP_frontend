import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';

export interface Breadcrumb {
  readonly label: string;
  readonly url: string;
}

/** Builds the trail from `data: { breadcrumb: 'Users' }` on each matched route. */
export function buildBreadcrumbs(root: ActivatedRouteSnapshot): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [];
  const segments: string[] = [];
  let route: ActivatedRouteSnapshot | null = root;
  while (route) {
    segments.push(...route.url.map((segment) => segment.path));
    const label: unknown = route.routeConfig?.data?.['breadcrumb'];
    if (typeof label === 'string' && crumbs.at(-1)?.label !== label) {
      crumbs.push({ label, url: '/' + segments.join('/') });
    }
    route = route.firstChild;
  }
  return crumbs;
}

@Component({
  selector: 'app-breadcrumbs',
  imports: [RouterLink, MatIconModule],
  template: `
    @if (crumbs().length > 1) {
      <nav aria-label="Breadcrumb" class="mb-3">
        <ol class="flex flex-wrap items-center gap-1 text-sm text-on-surface-variant">
          @for (crumb of crumbs(); track crumb.url; let last = $last) {
            <li class="flex items-center gap-1">
              @if (last) {
                <span aria-current="page" class="text-on-surface">{{ crumb.label }}</span>
              } @else {
                <a [routerLink]="crumb.url" class="hover:underline">{{ crumb.label }}</a>
                <mat-icon class="app-icon-sm" aria-hidden="true">chevron_right</mat-icon>
              }
            </li>
          }
        </ol>
      </nav>
    }
  `,
})
export class Breadcrumbs {
  private readonly router = inject(Router);

  protected readonly crumbs = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => buildBreadcrumbs(this.router.routerState.snapshot.root)),
    ),
    { initialValue: buildBreadcrumbs(this.router.routerState.snapshot.root) },
  );
}
