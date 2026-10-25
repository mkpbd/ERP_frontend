import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { EmptyState } from '../../../shared/components/state-views';

@Component({
  selector: 'app-not-found-page',
  imports: [EmptyState, MatButtonModule, RouterLink],
  template: `
    <app-empty-state
      icon="travel_explore"
      title="Page not found"
      message="The address may be mistyped or the page may have moved."
    >
      <a matButton="filled" routerLink="/dashboard">Go to dashboard</a>
    </app-empty-state>
  `,
})
export class NotFoundPage {}
