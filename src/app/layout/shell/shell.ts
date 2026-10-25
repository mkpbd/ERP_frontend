import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { Router, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Breadcrumbs } from '../breadcrumbs/breadcrumbs';
import { Footer } from '../footer/footer';
import { Header } from '../header/header';
import { Sidebar } from '../sidebar/sidebar';

/** Authenticated application frame: responsive sidenav, toolbar, breadcrumbs and the routed page. */
@Component({
  selector: 'app-shell',
  imports: [MatSidenavModule, MatProgressBarModule, RouterOutlet, Header, Sidebar, Breadcrumbs, Footer],
  template: `
    <a href="#main-content" class="app-skip-link" (click)="focusMain($event)">Skip to main content</a>
    <mat-sidenav-container class="h-dvh">
      <mat-sidenav
        id="app-sidenav"
        class="app-sidenav w-64"
        [mode]="compact() ? 'over' : 'side'"
        [opened]="sidenavOpen()"
        (openedChange)="sidenavOpen.set($event)"
      >
        <app-sidebar (navigate)="compact() && sidenavOpen.set(false)" />
      </mat-sidenav>

      <mat-sidenav-content class="flex min-h-full flex-col">
        <app-header
          [menuOpen]="sidenavOpen()"
          (menuToggle)="sidenavOpen.set(!sidenavOpen())"
          (signOut)="signOut()"
        />
        <div class="h-1" aria-hidden="true">
          @if (navigating()) {
            <mat-progress-bar mode="indeterminate" />
          }
        </div>
        <main
          id="main-content"
          tabindex="-1"
          class="mx-auto w-full max-w-7xl flex-1 px-4 pb-8 pt-4 outline-none md:px-6"
        >
          <app-breadcrumbs />
          <router-outlet />
        </main>
        <app-footer />
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Below 960px the sidenav overlays the content and starts closed. */
  protected readonly compact = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 959.98px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  /** Follows the breakpoint (open on desktop, closed on mobile) until the user toggles it. */
  protected readonly sidenavOpen = linkedSignal(() => !this.compact());

  protected readonly navigating = computed(() => !!this.router.currentNavigation());

  protected signOut(): void {
    this.auth.logout().subscribe();
  }

  protected focusMain(event: Event): void {
    event.preventDefault();
    document.getElementById('main-content')?.focus();
  }
}
