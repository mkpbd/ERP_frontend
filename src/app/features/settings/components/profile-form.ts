import { Component, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize, switchMap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { toApiError } from '../../../core/http/api-error';
import { NotificationService } from '../../../core/services/notification.service';
import { ValidationMessagePipe } from '../../../shared/pipes/validation-message.pipe';
import { applyServerErrors } from '../../../shared/utils/form-errors';
import { AccountApi } from '../services/account-api.service';

@Component({
  selector: 'app-profile-form',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, ValidationMessagePipe],
  template: `
    @if (auth.user(); as user) {
      <form [formGroup]="form" (ngSubmit)="save()" class="flex max-w-xl flex-col gap-3" novalidate>
        <mat-form-field>
          <mat-label>Display name</mat-label>
          <input matInput formControlName="displayName" autocomplete="name" required />
          <mat-error>{{ form.controls.displayName.errors | validationMessage: 'Display name' }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Email</mat-label>
          <input matInput [value]="user.email" disabled />
          <mat-hint>Ask an administrator to change your email address.</mat-hint>
        </mat-form-field>
        <div class="text-sm text-on-surface-variant">
          Roles: {{ user.roles.length ? user.roles.join(', ') : 'none' }}
        </div>
        <div>
          <button matButton="filled" type="submit" [disabled]="form.pristine || saving()">
            Save profile
          </button>
        </div>
      </form>
    }
  `,
})
export class ProfileForm {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(AccountApi);
  private readonly notifications = inject(NotificationService);

  protected readonly form = inject(NonNullableFormBuilder).group({
    displayName: ['', [Validators.required, Validators.maxLength(100)]],
  });
  protected readonly saving = signal(false);

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (user) this.form.reset({ displayName: user.displayName });
    });
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.api
      .updateProfile(this.form.getRawValue().displayName.trim())
      .pipe(
        switchMap(() => this.auth.reloadUser()),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => this.notifications.success('Profile saved.'),
        error: (error: unknown) => {
          const unplaced = applyServerErrors(this.form, toApiError(error), {
            invalid_display_name: 'displayName',
          });
          if (unplaced) this.notifications.error(error);
        },
      });
  }
}
