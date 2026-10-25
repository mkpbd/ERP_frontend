import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { APP_NAME } from '../../core/services/app-title.strategy';

/** Centered card frame for sign-in and account-recovery pages. */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet],
  template: `
    <main class="flex min-h-dvh items-center justify-center bg-surface-container-low px-4 py-10">
      <div class="w-full max-w-md">
        <div class="mb-6 flex items-center justify-center gap-3">
          <span
            class="grid h-10 w-10 place-items-center rounded-card bg-primary text-base font-bold text-on-primary"
            aria-hidden="true"
            >{{ appName[0] }}</span
          >
          <span class="text-2xl font-medium">{{ appName }}</span>
        </div>
        <div class="app-card p-6 sm:p-8">
          <router-outlet />
        </div>
      </div>
    </main>
  `,
})
export class AuthLayout {
  protected readonly appName = APP_NAME;
}
