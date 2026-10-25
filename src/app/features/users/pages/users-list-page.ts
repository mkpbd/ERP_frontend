import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { PageHeader } from '../../../shared/components/page-header';
import { EmptyState, ErrorState } from '../../../shared/components/state-views';
import { StatusBadge } from '../../../shared/components/status-badge';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PAGE_SIZE_OPTIONS } from '../../../shared/models/page';
import { CreateUserDialog } from '../components/create-user-dialog';
import type { UserSortField, UserStatus } from '../models/user.models';
import { UsersListStore } from '../state/users-list.store';

@Component({
  selector: 'app-users-list-page',
  providers: [UsersListStore],
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    PageHeader,
    EmptyState,
    ErrorState,
    StatusBadge,
    HasPermissionDirective,
  ],
  template: `
    <app-page-header title="Users" subtitle="People who can sign in to the system.">
      <button
        matButton="filled"
        type="button"
        *appHasPermission="'users:create'"
        (click)="openCreate()"
        data-testid="create-user"
      >
        <mat-icon>person_add</mat-icon>
        New user
      </button>
    </app-page-header>

    <div class="app-dense mb-4 flex flex-col gap-3 sm:flex-row" role="search" aria-label="Filter users">
      <mat-form-field class="flex-1">
        <mat-label>Search</mat-label>
        <mat-icon matPrefix aria-hidden="true">search</mat-icon>
        <input
          matInput
          [formControl]="search"
          placeholder="Name, email or username"
          data-testid="user-search"
        />
        @if (search.value) {
          <button
            matIconSuffix
            matIconButton
            type="button"
            aria-label="Clear search"
            (click)="search.setValue('')"
          >
            <mat-icon>close</mat-icon>
          </button>
        }
      </mat-form-field>
      <mat-form-field class="sm:w-48">
        <mat-label>Status</mat-label>
        <mat-select [value]="store.query().status ?? ''" (selectionChange)="setStatus($event.value)">
          <mat-option value="">All</mat-option>
          <mat-option value="active">Active</mat-option>
          <mat-option value="deactivated">Deactivated</mat-option>
        </mat-select>
      </mat-form-field>
    </div>

    @if (store.error(); as error) {
      <app-error-state [error]="error" title="Could not load users" (retry)="store.reload()" />
    } @else if (store.isEmpty()) {
      <app-empty-state
        icon="person_search"
        [title]="store.hasFilters() ? 'No users match your filters' : 'No users yet'"
        [message]="store.hasFilters() ? 'Try a different search or status.' : undefined"
      >
        @if (store.hasFilters()) {
          <button matButton type="button" (click)="clearFilters()">Clear filters</button>
        }
      </app-empty-state>
    } @else {
      <div class="app-card relative overflow-hidden">
        <div class="h-1">
          @if (store.loading()) {
            <mat-progress-bar mode="indeterminate" aria-label="Loading users" />
          }
        </div>
        <div class="overflow-x-auto">
          <table
            mat-table
            [dataSource]="store.users()"
            matSort
            [matSortActive]="store.query().sort"
            [matSortDirection]="store.query().order"
            (matSortChange)="sort($event)"
            class="min-w-[640px]"
            aria-label="Users"
            [attr.aria-busy]="store.loading()"
          >
            <ng-container matColumnDef="displayName">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Name</th>
              <td mat-cell *matCellDef="let user">
                <a [routerLink]="['/users', user.id]" class="font-medium text-primary hover:underline">{{
                  user.displayName
                }}</a>
                @if (user.username) {
                  <div class="text-xs text-on-surface-variant">{{ '@' + user.username }}</div>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="email">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Email</th>
              <td mat-cell *matCellDef="let user">{{ user.email }}</td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let user">
                <app-status-badge
                  [label]="user.status === 'active' ? 'Active' : 'Deactivated'"
                  [tone]="user.status === 'active' ? 'success' : 'neutral'"
                />
              </td>
            </ng-container>
            <ng-container matColumnDef="lastLoginAt">
              <th mat-header-cell *matHeaderCellDef>Last sign-in</th>
              <td mat-cell *matCellDef="let user">
                {{ user.lastLoginAt ? (user.lastLoginAt | date: 'medium') : 'Never' }}
              </td>
            </ng-container>
            <ng-container matColumnDef="createdAt">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Created</th>
              <td mat-cell *matCellDef="let user">{{ user.createdAt | date: 'mediumDate' }}</td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>
        <mat-paginator
          [length]="store.total()"
          [pageIndex]="store.query().page - 1"
          [pageSize]="store.query().pageSize"
          [pageSizeOptions]="pageSizeOptions"
          (page)="page($event)"
          aria-label="Select page of users"
        />
      </div>
    }
  `,
})
export class UsersListPage {
  protected readonly store = inject(UsersListStore);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  protected readonly columns = ['displayName', 'email', 'status', 'lastLoginAt', 'createdAt'];
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly search = new FormControl('', { nonNullable: true });

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((value) => this.store.setSearch(value));
  }

  protected setStatus(status: UserStatus | ''): void {
    this.store.setStatus(status || undefined);
  }

  protected sort(event: Sort): void {
    this.store.setSort(event.active as UserSortField, event.direction);
  }

  protected page(event: PageEvent): void {
    this.store.setPage(event.pageIndex, event.pageSize);
  }

  protected clearFilters(): void {
    this.search.setValue('', { emitEvent: false });
    this.store.clearFilters();
  }

  protected openCreate(): void {
    this.dialog
      .open<CreateUserDialog, void, { id: string }>(CreateUserDialog, { width: '32rem', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((created) => {
        if (!created) return;
        this.notifications.success('User created.');
        void this.router.navigate(['/users', created.id]);
      });
  }
}
