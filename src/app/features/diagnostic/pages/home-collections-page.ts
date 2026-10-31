import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { Authorization } from '../../../core/authorization/authorization.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ReportDownloadService } from '../../../core/services/report-download.service';
import { PageHeader } from '../../../shared/components/page-header';
import { ReasonDialog, type ReasonDialogData } from '../../../shared/components/reason-dialog';
import { EmptyState, ErrorState } from '../../../shared/components/state-views';
import { StatusBadge } from '../../../shared/components/status-badge';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { AssignCollectorDialog } from '../components/assign-collector-dialog';
import { BillBookingDialog, type BillBookingResult } from '../components/bill-booking-dialog';
import { BookCollectionDialog, type BookCollectionDialogData } from '../components/book-collection-dialog';
import {
  type BillableBooking,
  COLLECTION_LABELS,
  COLLECTION_TONES,
  fromDay,
  type HomeCollection,
  toCollect,
  toDay,
} from '../models/diagnostic.models';
import { DiagnosticApi } from '../services/diagnostic-api.service';
import { CollectionBoardStore } from '../state/booking-boards.store';

const WIDE = { width: '44rem', maxWidth: '95vw' } as const;

/**
 * Home collections of a day (the old system had no desk screen for them): the desk books, sends collectors and
 * bills; a collector sees their own visits and records the samples as taken.
 */
@Component({
  selector: 'app-home-collections-page',
  providers: [CollectionBoardStore],
  imports: [
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    PageHeader,
    EmptyState,
    ErrorState,
    StatusBadge,
    HasPermissionDirective,
  ],
  template: `
    <app-page-header title="Home collections" [subtitle]="subtitle">
      <button matButton="outlined" type="button" (click)="sheet()" data-testid="run-sheet">
        <mat-icon>print</mat-icon>
        Run sheet
      </button>
      <button
        matButton="filled"
        type="button"
        *appHasPermission="'diag:book'"
        (click)="book()"
        data-testid="book-collection"
      >
        <mat-icon>add</mat-icon>
        Book home collection
      </button>
    </app-page-header>

    <div class="app-dense mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Day">
      <button matIconButton type="button" aria-label="Previous day" (click)="store.shift(-1)">
        <mat-icon>chevron_left</mat-icon>
      </button>
      <mat-form-field class="w-44">
        <mat-label>Day</mat-label>
        <input matInput [matDatepicker]="picker" [value]="day()" (dateChange)="pickDay($event)" />
        <mat-datepicker-toggle matIconSuffix [for]="picker" />
        <mat-datepicker #picker />
      </mat-form-field>
      <button matIconButton type="button" aria-label="Next day" (click)="store.shift(1)">
        <mat-icon>chevron_right</mat-icon>
      </button>
      @if (!store.isToday()) {
        <button matButton type="button" (click)="store.today()">Today</button>
      }
      @if (isDesk) {
        <mat-form-field class="w-44">
          <mat-label>Area</mat-label>
          <mat-select [value]="store.areaId()" (valueChange)="store.areaId.set($event)">
            <mat-option [value]="null">All areas</mat-option>
            @for (area of areas(); track area.id) {
              <mat-option [value]="area.id">{{ area.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field class="w-48">
          <mat-label>Collector</mat-label>
          <mat-select [value]="store.collectorId()" (valueChange)="store.collectorId.set($event)">
            <mat-option [value]="null">All collectors</mat-option>
            @if (isCollector) {
              <mat-option value="me">Mine</mat-option>
            }
            @for (collector of collectors(); track collector.id) {
              <mat-option [value]="collector.id">{{ collector.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
    </div>

    <div class="h-1">
      @if (store.loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading the home collections" />
      }
    </div>

    @if (store.error(); as error) {
      <app-error-state [error]="error" title="Could not load the home collections" (retry)="store.reload()" />
    } @else if (store.board(); as board) {
      <p class="mb-3 text-sm text-on-surface-variant" data-testid="collection-summary">
        {{ board.summary.booked }} waiting for a collector · {{ board.summary.assigned }} on the way ·
        {{ board.summary.collected }} collected · {{ board.summary.cancelled }} cancelled ·
        {{ board.summary.unbilled }} not billed · {{ board.summary.amount | currency: 'BDT' : '৳ ' }} quoted
      </p>
      @if (board.items.length === 0) {
        <app-empty-state icon="home_health" title="No home collection on this day" />
      } @else {
        <div class="app-card overflow-x-auto">
          <table mat-table [dataSource]="board.items" aria-label="Home collections">
            <ng-container matColumnDef="window">
              <th mat-header-cell *matHeaderCellDef>Window</th>
              <td mat-cell *matCellDef="let row">
                {{ row.windowLabel }}
                <span class="block text-xs text-on-surface-variant">{{ row.number }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="patient">
              <th mat-header-cell *matHeaderCellDef>Patient</th>
              <td mat-cell *matCellDef="let row">
                {{ row.patientName }}
                <span class="block text-xs text-on-surface-variant">
                  {{ row.uhid ? 'UHID ' + row.uhid + ' · ' : 'Not registered · ' }}{{ row.mobileNo }}
                </span>
              </td>
            </ng-container>
            <ng-container matColumnDef="address">
              <th mat-header-cell *matHeaderCellDef>Address</th>
              <td mat-cell *matCellDef="let row" class="max-w-xs">
                <span class="font-medium">{{ row.areaName }}</span>
                <span class="block">{{ row.address }}</span>
                @if (row.landmark) {
                  <span class="block text-xs text-on-surface-variant">Near {{ row.landmark }}</span>
                }
                @if (row.patientNote) {
                  <span class="block text-xs italic text-on-surface-variant">{{ row.patientNote }}</span>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="tests">
              <th mat-header-cell *matHeaderCellDef>Tests</th>
              <td mat-cell *matCellDef="let row">{{ testNames(row) }}</td>
            </ng-container>
            <ng-container matColumnDef="collect">
              <th mat-header-cell *matHeaderCellDef class="text-right">To collect</th>
              <td mat-cell *matCellDef="let row" class="text-right tabular-nums">
                {{ toCollect(row) | currency: 'BDT' : '৳ ' }}
                <span class="block text-xs text-on-surface-variant">{{
                  row.billNumber ?? 'not billed'
                }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let row">
                <app-status-badge [label]="label(row)" [tone]="tone(row)" />
                @if (row.collectorName) {
                  <span class="block text-xs text-on-surface-variant">{{ row.collectorName }}</span>
                }
                @if (row.collectedAt) {
                  <span class="block text-xs text-on-surface-variant"
                    >at {{ row.collectedAt | date: 'shortTime' }}</span
                  >
                }
                @if (row.statusReason) {
                  <span class="block text-xs text-on-surface-variant">{{ row.statusReason }}</span>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef><span class="app-sr-only">Actions</span></th>
              <td mat-cell *matCellDef="let row" class="whitespace-nowrap text-right">
                @if (row.status === 'assigned' && (canBook || row.collectorId === me())) {
                  <button
                    matButton="tonal"
                    type="button"
                    [attr.aria-label]="'Collected ' + row.number"
                    (click)="collected(row)"
                  >
                    Collected
                  </button>
                }
                @if (canBill && !row.billId && row.status !== 'cancelled') {
                  <button
                    matButton
                    type="button"
                    [attr.aria-label]="'Bill ' + row.number"
                    (click)="bill(row)"
                  >
                    Bill
                  </button>
                }
                @if (canBook && (row.status === 'booked' || row.status === 'assigned')) {
                  <button
                    matIconButton
                    type="button"
                    [attr.aria-label]="'Collector for ' + row.number"
                    (click)="assign(row)"
                  >
                    <mat-icon>directions_bike</mat-icon>
                  </button>
                  @if (!row.billId) {
                    <button
                      matIconButton
                      type="button"
                      [attr.aria-label]="'Cancel ' + row.number"
                      (click)="cancel(row)"
                    >
                      <mat-icon>event_busy</mat-icon>
                    </button>
                  }
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>
      }
    }
  `,
})
export class HomeCollectionsPage {
  protected readonly store = inject(CollectionBoardStore);
  private readonly api = inject(DiagnosticApi);
  private readonly dialog = inject(MatDialog);
  private readonly reports = inject(ReportDownloadService);
  private readonly notifications = inject(NotificationService);
  private readonly authorization = inject(Authorization);
  private readonly auth = inject(AuthService);

  /** The desk sees every visit; a collector without diag:read sees their own. */
  protected readonly isDesk = this.authorization.can('diag:read');
  protected readonly isCollector = this.authorization.can('diag:collect');
  protected readonly subtitle = this.isDesk
    ? "Collectors sent to patients' homes for their samples."
    : 'The visits given to you.';
  protected readonly canBook = this.authorization.can('diag:book');
  protected readonly canBill = this.authorization.can('diag:bill');
  protected readonly me = computed(() => this.auth.user()?.id ?? null);
  protected readonly labels = COLLECTION_LABELS;
  protected readonly tones = COLLECTION_TONES;
  protected readonly columns = ['window', 'patient', 'address', 'tests', 'collect', 'status', 'actions'];
  protected readonly day = () => fromDay(this.store.day());
  protected readonly toCollect = toCollect;

  private readonly areasResource = rxResource({
    stream: () => (this.isDesk ? this.api.areas(false) : of([])),
  });
  protected readonly areas = computed(() =>
    this.areasResource.hasValue() ? this.areasResource.value() : [],
  );
  private readonly collectorsResource = rxResource({
    stream: () => (this.canBook ? this.api.collectors() : of([])),
  });
  protected readonly collectors = computed(() =>
    this.collectorsResource.hasValue() ? this.collectorsResource.value() : [],
  );

  constructor() {
    if (!this.isDesk) this.store.collectorId.set('me');
  }

  protected label(row: HomeCollection): string {
    return this.labels[row.status];
  }

  protected tone(row: HomeCollection) {
    return this.tones[row.status];
  }

  protected testNames(row: HomeCollection): string {
    return row.tests.map((test) => test.testName).join(', ');
  }

  protected pickDay(event: MatDatepickerInputEvent<Date>): void {
    if (event.value) this.store.setDay(toDay(event.value));
  }

  protected book(): void {
    this.dialog
      .open<BookCollectionDialog, BookCollectionDialogData, { id: string; number: string }>(
        BookCollectionDialog,
        {
          ...WIDE,
          data: { day: this.store.day() },
        },
      )
      .afterClosed()
      .subscribe((booked) => {
        if (!booked) return;
        this.notifications.success(`Booked ${booked.number}.`);
        this.store.reload();
      });
  }

  protected assign(row: HomeCollection): void {
    this.dialog
      .open<AssignCollectorDialog, HomeCollection, true>(AssignCollectorDialog, { ...WIDE, data: row })
      .afterClosed()
      .subscribe((done) => {
        if (!done) return;
        this.notifications.success('Collector sent.');
        this.store.reload();
      });
  }

  protected collected(row: HomeCollection): void {
    this.dialog
      .open<ReasonDialog, ReasonDialogData, true>(ReasonDialog, {
        ...WIDE,
        data: {
          title: `Samples of ${row.number} taken?`,
          message: `${row.patientName}, ${row.areaName}: the samples are taken at home and brought to the lab.`,
          confirmText: 'Collected',
          label: 'Note (tubes, fasting …)',
          destructive: false,
          optional: true,
          submit: (note) => this.api.collected(row.id, row.version, note || null),
        },
      })
      .afterClosed()
      .subscribe((done) => {
        if (!done) return;
        this.notifications.success('Recorded as collected.');
        this.store.reload();
      });
  }

  protected bill(row: HomeCollection): void {
    const booking: BillableBooking = {
      kind: 'home_collection',
      id: row.id,
      number: row.number,
      patientId: row.patientId,
      patientName: row.patientName,
      mobileNo: row.mobileNo,
      tests: row.tests,
      charge: row.charge,
    };
    this.dialog
      .open<BillBookingDialog, BillableBooking, BillBookingResult>(BillBookingDialog, {
        ...WIDE,
        data: booking,
      })
      .afterClosed()
      .subscribe((bill) => {
        if (!bill) return;
        this.notifications.success(`Billed on ${bill.number}.`);
        this.store.reload();
        this.reports
          .download('hospital.diagnostic-receipt', { id: bill.id }, `receipt-${bill.number}`)
          .subscribe({ error: (error: unknown) => this.notifications.error(error) });
      });
  }

  protected cancel(row: HomeCollection): void {
    this.dialog
      .open<ReasonDialog, ReasonDialogData, true>(ReasonDialog, {
        ...WIDE,
        data: {
          title: `Cancel ${row.number}?`,
          message: `No collector goes to ${row.patientName}.`,
          confirmText: 'Cancel the visit',
          submit: (reason) => this.api.cancelCollection(row.id, row.version, reason),
        },
      })
      .afterClosed()
      .subscribe((done) => {
        if (!done) return;
        this.notifications.success('Home collection cancelled.');
        this.store.reload();
      });
  }

  protected sheet(): void {
    const collectorId = this.store.collectorId();
    const params: Record<string, unknown> = { date: this.store.day() };
    if (collectorId) params['collectorId'] = collectorId === 'me' ? this.me() : collectorId;
    this.reports
      .download('hospital.home-collection-sheet', params, `home-collections-${this.store.day()}`)
      .subscribe({ error: (error: unknown) => this.notifications.error(error) });
  }
}
