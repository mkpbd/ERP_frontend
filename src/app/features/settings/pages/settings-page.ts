import { Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { PageHeader } from '../../../shared/components/page-header';
import { ChangePasswordForm } from '../components/change-password-form';
import { ProfileForm } from '../components/profile-form';
import { SessionsList } from '../components/sessions-list';

@Component({
  selector: 'app-settings-page',
  imports: [MatTabsModule, PageHeader, ProfileForm, ChangePasswordForm, SessionsList],
  template: `
    <app-page-header title="Account settings" subtitle="Your profile, password and signed-in devices." />
    <mat-tab-group mat-stretch-tabs="false" animationDuration="0ms">
      <mat-tab label="Profile">
        <div class="pt-6"><app-profile-form /></div>
      </mat-tab>
      <mat-tab label="Password">
        <ng-template matTabContent>
          <div class="pt-6"><app-change-password-form /></div>
        </ng-template>
      </mat-tab>
      <mat-tab label="Sessions">
        <!-- Lazy: sessions are fetched only when the tab is opened. -->
        <ng-template matTabContent>
          <div class="pt-6"><app-sessions-list /></div>
        </ng-template>
      </mat-tab>
    </mat-tab-group>
  `,
})
export class SettingsPage {}
