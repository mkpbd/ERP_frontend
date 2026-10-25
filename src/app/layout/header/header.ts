import { Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ThemePreference, ThemeService } from '../../core/services/theme.service';

const THEME_OPTIONS: readonly { value: ThemePreference; label: string; icon: string }[] = [
  { value: 'system', label: 'System theme', icon: 'brightness_auto' },
  { value: 'light', label: 'Light theme', icon: 'light_mode' },
  { value: 'dark', label: 'Dark theme', icon: 'dark_mode' },
];

@Component({
  selector: 'app-header',
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule,
    RouterLink,
  ],
  template: `
    <mat-toolbar class="app-toolbar sticky top-0 z-10 gap-2 border-b border-outline-variant">
      @if (showMenuButton()) {
        <button
          matIconButton
          type="button"
          aria-label="Toggle navigation menu"
          [attr.aria-expanded]="menuOpen()"
          aria-controls="app-sidenav"
          (click)="menuToggle.emit()"
          data-testid="menu-toggle"
        >
          <mat-icon>menu</mat-icon>
        </button>
      }
      <span class="flex-1"></span>

      <button
        matIconButton
        type="button"
        [matMenuTriggerFor]="themeMenu"
        [matTooltip]="currentTheme().label"
        [attr.aria-label]="'Change theme. Current: ' + currentTheme().label"
      >
        <mat-icon>{{ currentTheme().icon }}</mat-icon>
      </button>
      <mat-menu #themeMenu="matMenu">
        @for (option of themeOptions; track option.value) {
          <button
            mat-menu-item
            type="button"
            (click)="theme.preference.set(option.value)"
            [attr.aria-checked]="theme.preference() === option.value"
            role="menuitemradio"
          >
            <mat-icon>{{ option.icon }}</mat-icon>
            <span>{{ option.label }}</span>
          </button>
        }
      </mat-menu>

      @if (user(); as user) {
        <button
          matButton
          type="button"
          [matMenuTriggerFor]="userMenu"
          aria-label="Account menu"
          data-testid="user-menu"
        >
          <span
            class="mr-2 inline-grid h-8 w-8 place-items-center rounded-full bg-primary-container text-sm font-medium text-on-primary-container"
            aria-hidden="true"
            >{{ initials() }}</span
          >
          <span class="hidden max-w-40 truncate sm:inline">{{ user.displayName }}</span>
        </button>
        <mat-menu #userMenu="matMenu" xPosition="before">
          <div class="px-4 py-2" role="presentation">
            <div class="font-medium">{{ user.displayName }}</div>
            <div class="text-sm text-on-surface-variant">{{ user.email }}</div>
          </div>
          <mat-divider />
          <a mat-menu-item routerLink="/settings">
            <mat-icon>manage_accounts</mat-icon>
            <span>Account settings</span>
          </a>
          <button mat-menu-item type="button" (click)="signOut.emit()" data-testid="sign-out">
            <mat-icon>logout</mat-icon>
            <span>Sign out</span>
          </button>
        </mat-menu>
      }
    </mat-toolbar>
  `,
})
export class Header {
  private readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly themeOptions = THEME_OPTIONS;

  readonly showMenuButton = input(true);
  readonly menuOpen = input(false);
  readonly menuToggle = output();
  readonly signOut = output();

  protected readonly user = this.auth.user;
  protected readonly initials = computed(() =>
    (this.user()?.displayName ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join(''),
  );
  protected readonly currentTheme = computed(
    () => THEME_OPTIONS.find((option) => option.value === this.theme.preference()) ?? THEME_OPTIONS[0]!,
  );
}
