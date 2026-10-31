import { DatePipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import type { Observable } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { ReportDownloadService } from '../../../core/services/report-download.service';
import { ReasonDialog, type ReasonDialogData } from '../../../shared/components/reason-dialog';
import { StatusBadge } from '../../../shared/components/status-badge';
import {
  type Order,
  type OrderKind,
  ORDER_LABELS,
  ORDER_TONES,
  ROUTE_LABELS,
  scheduleText,
  type SlotState,
} from '../models/nursing.models';
import { StayNursingStore } from '../state/stay-nursing.store';
import { OrderDialog, type OrderDialogData } from './order-dialog';

const SLOT_CLASSES: Record<SlotState, string> = {
  given: 'border-[light-dark(#2e7d32,#81c784)] bg-[light-dark(#e8f5e9,#10301a)]',
  missed: 'border-error bg-error-container text-on-error-container',
  due: 'border-outline',
  overdue: 'border-[light-dark(#b26a00,#ffb74d)] bg-[light-dark(#fff3e0,#3a2600)]',
};

/**
 * A day's chart of one kind of order (old medication administration, and non-medication orders): each order with its
 * due times given (done), missed or outstanding, and the doctor's hold, resume and stop.
 */
@Component({
  selector: 'app-chart-panel',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatMenuModule, StatusBadge],
  template: `
    <div class="mb-3 flex flex-wrap items-center gap-2">
      @if (store.canOrder()) {
        <button matButton="tonal" type="button" (click)="order()" [attr.data-testid]="'order-' + kind()">
          <mat-icon>add</mat-icon>
          {{ care() ? 'Order care' : 'Order a medicine' }}
        </button>
      }
      <button matButton type="button" (click)="print()">
        <mat-icon>print</mat-icon>
        Print the day's chart
      </button>
    </div>
    <ul class="flex flex-col gap-3" [attr.aria-label]="care() ? 'Care chart' : 'Medication chart'">
      @for (row of chartOrders(); track row.id) {
        <li class="app-card p-4">
          <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div>
              <div class="font-medium">{{ row.drugName }}</div>
              <div class="text-sm text-on-surface-variant">
                {{ row.dose }}{{ row.route ? ' · ' + routeLabels[row.route] : '' }} · {{ schedule(row) }} ·
                {{ row.doctorName }}
              </div>
              @if (row.note) {
                <div class="text-xs text-on-surface-variant">{{ row.note }}</div>
              }
            </div>
            <div class="flex items-center gap-1">
              <app-status-badge [label]="statusLabels[row.status]" [tone]="tones[row.status]" />
              @if (store.canOrder() && row.status !== 'stopped') {
                <button
                  matIconButton
                  type="button"
                  [matMenuTriggerFor]="menu"
                  [attr.aria-label]="'Change ' + row.drugName"
                >
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu="matMenu">
                  @if (row.status === 'active') {
                    <button mat-menu-item type="button" (click)="hold(row)">Hold</button>
                  } @else {
                    <button mat-menu-item type="button" (click)="resume(row)">Resume</button>
                  }
                  <button mat-menu-item type="button" (click)="stop(row)">Stop</button>
                </mat-menu>
              }
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            @for (slot of row.slots; track slot.dueAt) {
              <div
                class="flex items-center gap-1 rounded-card border px-2 py-1 text-sm"
                [class]="slotClass(slot.state)"
              >
                <span class="font-mono">{{ slot.dueAt | date: 'shortTime' }}</span>
                @switch (slot.state) {
                  @case ('given') {
                    <span
                      >{{ care() ? 'done' : 'given' }} {{ slot.record?.givenAt | date: 'shortTime' }}</span
                    >
                  }
                  @case ('missed') {
                    <span>{{ care() ? 'not done' : 'missed' }}: {{ slot.record?.reason }}</span>
                  }
                  @default {
                    @if (store.canWrite()) {
                      <button
                        matButton
                        type="button"
                        class="!min-w-0 !px-2"
                        (click)="given(row.id, slot.dueAt)"
                        [attr.aria-label]="
                          (care() ? 'Done ' : 'Given ') +
                          row.drugName +
                          ' at ' +
                          (slot.dueAt | date: 'shortTime')
                        "
                      >
                        {{ care() ? 'Done' : 'Given' }}
                      </button>
                      <button
                        matButton
                        type="button"
                        class="!min-w-0 !px-2"
                        (click)="missed(row.id, slot.dueAt, row.drugName)"
                        [attr.aria-label]="
                          (care() ? 'Not done ' : 'Missed ') +
                          row.drugName +
                          ' at ' +
                          (slot.dueAt | date: 'shortTime')
                        "
                      >
                        {{ care() ? 'Not done' : 'Missed' }}
                      </button>
                    } @else {
                      <span>{{ slot.state }}</span>
                    }
                  }
                }
              </div>
            }
            @for (dose of row.doses; track dose.id) {
              <span class="rounded-card border px-2 py-1 text-sm" [class]="slotClass('given')">
                {{ dose.givenAt | date: 'shortTime' }} {{ care() ? 'done' : 'given' }} (when needed)
              </span>
            }
            @if (row.schedule === 'prn' && row.status === 'active' && store.canWrite()) {
              <button matButton="outlined" type="button" (click)="given(row.id, null)">
                {{ care() ? 'Done now' : 'Given now' }}
              </button>
            }
          </div>
        </li>
      } @empty {
        <li class="app-card p-4 text-sm text-on-surface-variant">
          {{ care() ? 'No nursing care ordered for this day.' : 'No medicine ordered for this day.' }}
        </li>
      }
    </ul>
  `,
})
export class ChartPanel {
  readonly kind = input.required<OrderKind>();

  protected readonly store = inject(StayNursingStore);
  private readonly dialog = inject(MatDialog);
  private readonly notifications = inject(NotificationService);
  private readonly reports = inject(ReportDownloadService);

  protected readonly routeLabels = ROUTE_LABELS;
  protected readonly statusLabels = ORDER_LABELS;
  protected readonly tones = ORDER_TONES;
  protected readonly schedule = scheduleText;
  protected readonly care = computed(() => this.kind() === 'care');
  protected readonly chartOrders = computed(
    () => (this.care() ? this.store.care() : this.store.medicines())?.orders ?? [],
  );

  protected slotClass(state: SlotState): string {
    return SLOT_CLASSES[state];
  }

  protected order(): void {
    this.dialog
      .open<OrderDialog, OrderDialogData>(OrderDialog, {
        width: '36rem',
        maxWidth: '95vw',
        data: {
          kind: this.kind(),
          submit: (request) => this.store.act((id) => this.store.api.order(id, request)),
        },
      })
      .afterClosed()
      .subscribe((done) => {
        if (done) this.notifications.success(this.care() ? 'Care ordered.' : 'Medicine ordered.');
      });
  }

  protected given(orderId: string, dueAt: string | null): void {
    this.store
      .act(() => this.store.api.dose(orderId, dueAt, 'given', null))
      .subscribe({
        next: () => this.notifications.success(this.care() ? 'Marked done.' : 'Marked given.'),
        error: (error: unknown) => this.notifications.error(error),
      });
  }

  protected missed(orderId: string, dueAt: string, name: string): void {
    this.reason({
      title: `${name}: ${this.care() ? 'not done' : 'missed'}`,
      message: 'Say why, for the doctor.',
      confirmText: this.care() ? 'Not done' : 'Missed',
      label: 'Why',
      submit: (reason) => this.store.act(() => this.store.api.dose(orderId, dueAt, 'missed', reason)),
    }).subscribe();
  }

  protected hold(order: Order): void {
    this.reason({
      title: `Hold ${order.drugName}?`,
      message: 'Nothing is due while it is held; it can be resumed.',
      confirmText: 'Hold',
      submit: (reason) => this.store.act(() => this.store.api.hold(order.id, order.version, reason)),
    }).subscribe();
  }

  protected resume(order: Order): void {
    this.store
      .act(() => this.store.api.resume(order.id, order.version))
      .subscribe({
        next: () => this.notifications.success('Resumed.'),
        error: (error: unknown) => this.notifications.error(error),
      });
  }

  protected stop(order: Order): void {
    this.reason({
      title: `Stop ${order.drugName}?`,
      message: 'A stopped order is done for good.',
      confirmText: 'Stop',
      submit: (reason) => this.store.act(() => this.store.api.stop(order.id, order.version, reason)),
    }).subscribe();
  }

  protected print(): void {
    const key = this.care() ? 'clinical.care-chart' : 'clinical.medication-chart';
    this.reports
      .download(
        key,
        { admissionId: this.store.admissionId(), day: this.store.day() },
        `${this.kind()}-chart-${this.store.day()}`,
      )
      .subscribe({ error: (error: unknown) => this.notifications.error(error) });
  }

  private reason(data: ReasonDialogData): Observable<unknown> {
    return this.dialog
      .open<ReasonDialog, ReasonDialogData, true>(ReasonDialog, { width: '28rem', maxWidth: '95vw', data })
      .afterClosed();
  }
}
