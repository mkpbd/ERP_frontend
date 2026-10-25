import { Component, computed, inject, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { APP_NAME } from '../../core/services/app-title.strategy';
import { filterNavigation } from '../navigation/navigation-filter';
import { NAVIGATION } from '../navigation/navigation.config';

@Component({
  selector: 'app-sidebar',
  imports: [MatListModule, MatIconModule, RouterLink, RouterLinkActive],
  template: `
    <div class="flex h-16 items-center gap-3 px-5">
      <span
        class="grid h-9 w-9 place-items-center rounded-card bg-primary text-sm font-bold text-on-primary"
        aria-hidden="true"
        >{{ appName[0] }}</span
      >
      <span class="text-lg font-medium">{{ appName }}</span>
    </div>
    <nav aria-label="Main">
      @for (section of sections(); track $index) {
        @if (section.label) {
          <h2 class="px-5 pb-1 pt-4 text-xs font-medium uppercase tracking-wider text-on-surface-variant">
            {{ section.label }}
          </h2>
        }
        <mat-nav-list class="app-nav-list">
          @for (item of section.items; track item.label) {
            @if (item.route) {
              <a
                mat-list-item
                [routerLink]="item.route"
                routerLinkActive
                #rla="routerLinkActive"
                [routerLinkActiveOptions]="{ exact: !!item.exact }"
                [activated]="rla.isActive"
                [attr.aria-current]="rla.isActive ? 'page' : null"
                (click)="navigate.emit()"
              >
                <mat-icon matListItemIcon aria-hidden="true">{{ item.icon }}</mat-icon>
                <span matListItemTitle>{{ item.label }}</span>
              </a>
            }
            @for (child of item.children ?? []; track child.label) {
              <a
                mat-list-item
                [style.padding-inline-start.rem]="2.5"
                [routerLink]="child.route"
                routerLinkActive
                #childRla="routerLinkActive"
                [activated]="childRla.isActive"
                [attr.aria-current]="childRla.isActive ? 'page' : null"
                (click)="navigate.emit()"
              >
                <mat-icon matListItemIcon aria-hidden="true">{{ child.icon }}</mat-icon>
                <span matListItemTitle>{{ child.label }}</span>
              </a>
            }
          }
        </mat-nav-list>
      }
    </nav>
  `,
})
export class Sidebar {
  private readonly auth = inject(AuthService);
  protected readonly appName = APP_NAME;

  /** Emitted after a link is chosen, so the shell can close the drawer on small screens. */
  readonly navigate = output();

  protected readonly sections = computed(() =>
    filterNavigation(NAVIGATION, { permissions: this.auth.permissions() }),
  );
}
