import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { EmptyState } from '../../../shared/components/state-views';

@Component({
  selector: 'app-forbidden-page',
  imports: [EmptyState, MatButtonModule, RouterLink],
  template: `
    <app-empty-state
      icon="lock"
      title="You don't have access to this page"
      message="Your account lacks the permission this page needs. Ask an administrator if you think this is a mistake."
    >
      <a matButton="filled" routerLink="/dashboard">Go to dashboard</a>
    </app-empty-state>
  `,
})
export class ForbiddenPage {}
