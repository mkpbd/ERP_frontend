import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { toApiError } from '../../../core/http/api-error';
import { ErrorState } from '../../../shared/components/state-views';
import { type DashboardHead, type DayRange, formatFigure } from '../models/dashboard.models';
import { DashboardApi } from '../services/dashboard-api.service';

export interface BreakdownDialogData {
  readonly head: DashboardHead;
  readonly range: DayRange;
}

/** Old dashboard drill-down: one figure split by day, user, ward, outlet and so on, as bars. */
@Component({
  selector: 'app-breakdown-dialog',
  imports: [MatButtonModule, MatButtonToggleModule, MatDialogModule, MatProgressBarModule, ErrorState],
  template: `
    <h2 mat-dialog-title>{{ data.head.label }}</h2>
    <mat-dialog-content>
      <p class="mb-3 text-sm text-on-surface-variant">
        {{ data.range.from === data.range.to ? data.range.from : data.range.from + ' to ' + data.range.to }}
        @if (data.head.current) {
          · as of now
        }
      </p>
      @if (data.head.dimensions.length > 1) {
        <mat-button-toggle-group
          class="mb-3"
          aria-label="Split by"
          [value]="by()"
          (change)="by.set($event.value)"
          hideSingleSelectionIndicator
        >
          @for (dimension of data.head.dimensions; track dimension.key) {
            <mat-button-toggle [value]="dimension.key">{{ dimension.label }}</mat-button-toggle>
          }
        </mat-button-toggle-group>
      }
      <div class="h-1">
        @if (rows.isLoading()) {
          <mat-progress-bar mode="indeterminate" aria-label="Loading the split" />
        }
      </div>
      @if (error(); as error) {
        <app-error-state [error]="error" title="Could not load the split" (retry)="rows.reload()" />
      } @else if (lines().length === 0 && !rows.isLoading()) {
        <p class="py-6 text-center text-sm text-on-surface-variant">Nothing in these days.</p>
      } @else {
        <table class="w-full text-sm" [attr.aria-label]="data.head.label + ' by ' + byLabel()">
          <tbody>
            @for (line of lines(); track line.label) {
              <tr>
                <th scope="row" class="w-2/5 py-1 pr-2 text-left font-normal">{{ line.label }}</th>
                <td class="py-1">
                  <div
                    class="h-3 rounded-pill bg-primary"
                    [style.width.%]="line.share"
                    aria-hidden="true"
                  ></div>
                </td>
                <td class="w-32 py-1 pl-2 text-right tabular-nums">{{ line.text }}</td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr class="border-t border-outline-variant font-medium">
              <th scope="row" class="py-1 text-left">Total</th>
              <td></td>
              <td class="py-1 text-right tabular-nums">{{ total() }}</td>
            </tr>
          </tfoot>
        </table>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
})
export class BreakdownDialog {
  protected readonly data = inject<BreakdownDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(DashboardApi);

  protected readonly by = signal(this.data.head.dimensions[0]?.key ?? 'day');
  protected readonly byLabel = computed(
    () => this.data.head.dimensions.find((dimension) => dimension.key === this.by())?.label ?? '',
  );
  protected readonly rows = rxResource({
    params: () => this.by(),
    stream: ({ params }) => this.api.breakdown(this.data.head.key, this.data.range, params),
  });
  protected readonly error = computed(() => {
    const error = this.rows.error();
    return error ? toApiError(error) : null;
  });
  protected readonly lines = computed(() => {
    const rows = this.rows.hasValue() ? this.rows.value().rows : [];
    const top = Math.max(...rows.map((row) => Math.abs(row.value)), 0);
    return rows.map((row) => ({
      label: row.label,
      share: top === 0 ? 0 : Math.max(1, Math.round((Math.abs(row.value) / top) * 100)),
      text: formatFigure(row.value, this.data.head.unit),
    }));
  });
  protected readonly total = computed(() => {
    const rows = this.rows.hasValue() ? this.rows.value().rows : [];
    return formatFigure(
      rows.reduce((sum, row) => sum + Math.round(row.value * 100), 0) / 100,
      this.data.head.unit,
    );
  });
}
