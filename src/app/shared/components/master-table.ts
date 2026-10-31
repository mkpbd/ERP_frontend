import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { filter, switchMap } from 'rxjs';
import { Authorization } from '../../core/authorization/authorization.service';
import { toApiError } from '../../core/http/api-error';
import { NotificationService } from '../../core/services/notification.service';
import type { MasterDefinition, RecordRow } from '../models/record-master';
import { RecordsApi } from '../services/records-api.service';
import { ConfirmService } from './confirm-dialog';
import { EmptyState, ErrorState } from './state-views';
import { StatusBadge } from './status-badge';
import { MasterDialog, type MasterDialogData } from './master-dialog';

/** One master's records, with add, edit and delete for the master's manage permission. */
@Component({
  selector: 'app-master-table',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTableModule,
    EmptyState,
    ErrorState,
    StatusBadge,
  ],
  template: `
    <div class="mb-3 flex justify-end">
      @if (canManage()) {
        <button matButton="filled" type="button" (click)="edit()">
          <mat-icon>add</mat-icon>
          New {{ definition().noun }}
        </button>
      }
    </div>
    @if (error(); as error) {
      <app-error-state
        [error]="error"
        [title]="'Could not load ' + definition().label"
        (retry)="records.reload()"
      />
    } @else if (!records.isLoading() && rows().length === 0) {
      <app-empty-state icon="inventory_2" [title]="'No ' + definition().label + ' yet'" />
    } @else {
      <div class="app-card relative overflow-hidden">
        <div class="h-1">
          @if (records.isLoading()) {
            <mat-progress-bar mode="indeterminate" [attr.aria-label]="'Loading ' + definition().label" />
          }
        </div>
        <div class="overflow-x-auto">
          <table mat-table [dataSource]="rows()" [attr.aria-label]="definition().label">
            @for (field of listed(); track field.key) {
              <ng-container [matColumnDef]="field.key">
                <th mat-header-cell *matHeaderCellDef>{{ field.label }}</th>
                <td mat-cell *matCellDef="let row">
                  @if (field.kind === 'toggle') {
                    <app-status-badge
                      [label]="row[field.key] ? 'Active' : 'Inactive'"
                      [tone]="row[field.key] ? 'success' : 'neutral'"
                    />
                  } @else {
                    {{ row[field.key] ?? '—' }}
                  }
                </td>
              </ng-container>
            }
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef><span class="app-sr-only">Actions</span></th>
              <td mat-cell *matCellDef="let row" class="whitespace-nowrap text-right">
                @if (canManage()) {
                  <button
                    matIconButton
                    type="button"
                    [attr.aria-label]="'Edit ' + title(row)"
                    (click)="edit(row)"
                  >
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button
                    matIconButton
                    type="button"
                    [attr.aria-label]="'Delete ' + title(row)"
                    (click)="remove(row)"
                  >
                    <mat-icon>delete</mat-icon>
                  </button>
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns()"></tr>
            <tr mat-row *matRowDef="let row; columns: columns()"></tr>
          </table>
        </div>
      </div>
    }
  `,
})
export class MasterTable {
  readonly definition = input.required<MasterDefinition>();

  private readonly api = inject(RecordsApi);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly notifications = inject(NotificationService);
  private readonly authorization = inject(Authorization);
  protected readonly canManage = computed(() => this.authorization.can(this.definition().managePermission));

  protected readonly records = rxResource({
    params: () => this.definition().path,
    stream: ({ params }) => this.api.list(params),
  });
  protected readonly rows = computed(() => (this.records.hasValue() ? this.records.value() : []));
  protected readonly error = computed(() => {
    const error = this.records.error();
    return error ? toApiError(error) : null;
  });
  protected readonly listed = computed(() => this.definition().fields.filter((field) => field.listed));
  protected readonly columns = computed(() => [...this.listed().map((field) => field.key), 'actions']);

  protected title(row: RecordRow): string {
    const key = this.definition().fields[0]?.key ?? 'name';
    return String(row[key] ?? '');
  }

  protected edit(record?: RecordRow): void {
    const definition = this.definition();
    this.dialog
      .open<MasterDialog, MasterDialogData, RecordRow>(MasterDialog, {
        data: { definition, ...(record ? { record } : {}) },
        width: '32rem',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((saved) => {
        if (!saved) return;
        this.notifications.success(record ? 'Saved.' : `${capitalize(definition.noun)} added.`);
        this.records.reload();
      });
  }

  protected remove(record: RecordRow): void {
    const definition = this.definition();
    this.confirm
      .confirm({
        title: `Delete ${this.title(record)}?`,
        message: `Only ${definition.noun}s nothing refers to can be deleted. Make it inactive instead when it is in use.`,
        confirmText: 'Delete',
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.remove(definition.path, record.id)),
      )
      .subscribe({
        next: () => {
          this.notifications.success('Deleted.');
          this.records.reload();
        },
        error: (error: unknown) => this.notifications.error(error),
      });
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
