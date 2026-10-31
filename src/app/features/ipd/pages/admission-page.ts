import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import { filter, map, Observable, switchMap } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { ReportDownloadService } from '../../../core/services/report-download.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog';
import { PageHeader } from '../../../shared/components/page-header';
import { ReasonDialog, type ReasonDialogData } from '../../../shared/components/reason-dialog';
import { ErrorState, LoadingState } from '../../../shared/components/state-views';
import { StatusBadge } from '../../../shared/components/status-badge';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { BedDialog, type BedDialogData } from '../components/bed-dialog';
import { CorrectDialog, type CorrectDialogData } from '../components/correct-dialog';
import { DischargeDialog, type DischargeDialogData } from '../components/discharge-dialog';
import { DoctorsDialog, type DoctorsDialogData } from '../components/doctors-dialog';
import { FinalBillDialog, type FinalBillDialogData } from '../components/final-bill-dialog';
import { MoneyDialog, type MoneyDialogData } from '../components/money-dialog';
import { PassDialog, type PassDialogData } from '../components/pass-dialog';
import { StayChargeDialog, type StayChargeDialogData } from '../components/stay-charge-dialog';
import {
  DISCHARGE_LABELS,
  type DischargeType,
  KIND_LABELS,
  PAYMENT_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
  type VisitorPass,
} from '../models/ipd.models';
import { AdmissionStore } from '../state/admission.store';

const WIDE = { width: '34rem', maxWidth: '95vw' };

/**
 * One stay: the patient, beds and doctors with the moves, corrections, discharge and reopening; the account with
 * charges, advances, the final bill and dues; the visitor passes.
 */
@Component({
  selector: 'app-admission-page',
  providers: [AdmissionStore],
  imports: [
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTabsModule,
    RouterLink,
    HasPermissionDirective,
    PageHeader,
    ErrorState,
    LoadingState,
    StatusBadge,
  ],
  template: `
    @if (store.error(); as error) {
      <app-error-state
        [error]="error"
        [title]="error.status === 404 ? 'Admission not found' : 'Could not load the admission'"
        [retryable]="error.status !== 404"
        (retry)="store.reload()"
      />
    } @else if (store.admission(); as a) {
      <app-page-header [title]="a.patientName" [subtitle]="subtitle()">
        <app-status-badge [label]="statusLabels[a.status]" [tone]="statusTones[a.status]" />
        <a matButton="outlined" [routerLink]="['/nursing/admissions', a.id]" *appHasPermission="'emr:read'">
          <mat-icon>monitor_heart</mat-icon>
          Nursing
        </a>
        @if (store.admitted() && store.canAdmit()) {
          <button matButton="outlined" type="button" (click)="transfer()" [disabled]="store.pending()">
            <mat-icon>swap_horiz</mat-icon>
            Move bed
          </button>
          <button matButton="filled" type="button" (click)="discharge()" [disabled]="store.pending()">
            <mat-icon>logout</mat-icon>
            Discharge
          </button>
        }
        @if (a.status === 'discharged' && store.canManage()) {
          <button matButton="outlined" type="button" (click)="reopen()" [disabled]="store.pending()">
            <mat-icon>undo</mat-icon>
            Reopen
          </button>
        }
        <button matIconButton type="button" [matMenuTriggerFor]="more" aria-label="More actions">
          <mat-icon>more_vert</mat-icon>
        </button>
        <mat-menu #more="matMenu">
          @if (store.admitted() && store.canAdmit()) {
            <button mat-menu-item type="button" (click)="correct()">
              <mat-icon>edit</mat-icon>
              Correct the admission
            </button>
            <button mat-menu-item type="button" (click)="consultant()">
              <mat-icon>stethoscope</mat-icon>
              Change consultant
            </button>
            <button mat-menu-item type="button" (click)="additional()">
              <mat-icon>group_add</mat-icon>
              Other doctors
            </button>
          }
          <button
            mat-menu-item
            type="button"
            (click)="print('hospital.admission-form', { id: a.id }, 'admission')"
          >
            <mat-icon>print</mat-icon>
            Print admission form
          </button>
          @if (store.admitted() && store.canManage()) {
            <button mat-menu-item type="button" (click)="cancel()">
              <mat-icon>cancel</mat-icon>
              Cancel admission
            </button>
          }
        </mat-menu>
      </app-page-header>

      <mat-tab-group mat-stretch-tabs="false" animationDuration="0ms">
        <mat-tab label="Stay">
          <div class="grid gap-4 pt-4 lg:grid-cols-2">
            <section class="app-card p-5" aria-labelledby="stay-heading">
              <h2 id="stay-heading" class="mb-4 text-lg font-medium">Admission</h2>
              <dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
                <dt class="text-on-surface-variant">Number</dt>
                <dd>{{ a.number }} · {{ kindLabels[a.kind] }}</dd>
                <dt class="text-on-surface-variant">Admitted</dt>
                <dd>{{ a.admittedAt | date: 'medium' }}</dd>
                <dt class="text-on-surface-variant">Reason</dt>
                <dd>{{ a.reason ?? '—' }}</dd>
                <dt class="text-on-surface-variant">Referred by</dt>
                <dd>{{ a.referredByName ?? 'Self' }}</dd>
                <dt class="text-on-surface-variant">Pays</dt>
                <dd>{{ a.corporateClientName ?? (a.staffId ? 'As staff' : 'The patient') }}</dd>
                @if (a.dischargedAt) {
                  <dt class="text-on-surface-variant">Discharged</dt>
                  <dd>
                    {{ a.dischargedAt | date: 'medium' }} · {{ dischargeLabel(a.dischargeType) }}
                    @if (a.dischargeNote) {
                      <div class="text-on-surface-variant">{{ a.dischargeNote }}</div>
                    }
                  </dd>
                }
                @if (a.cancelReason) {
                  <dt class="text-on-surface-variant">Cancelled</dt>
                  <dd>{{ a.cancelReason }}</dd>
                }
              </dl>
            </section>
            <section class="app-card p-5" aria-labelledby="doctors-heading">
              <h2 id="doctors-heading" class="mb-4 text-lg font-medium">Doctors</h2>
              <ul class="text-sm">
                @for (doctor of a.doctors; track $index) {
                  <li class="py-1" [class.text-on-surface-variant]="doctor.toAt">
                    {{ doctor.doctorName }} · {{ doctor.role === 'primary' ? 'consultant' : 'also sees' }}
                    <span class="text-xs">
                      from {{ doctor.fromAt | date: 'short'
                      }}{{ doctor.toAt ? ' to ' + (doctor.toAt | date: 'short') : '' }}
                    </span>
                  </li>
                }
              </ul>
            </section>
            <section class="app-card overflow-x-auto p-5 lg:col-span-2" aria-labelledby="beds-heading">
              <h2 id="beds-heading" class="mb-4 text-lg font-medium">Beds</h2>
              <table class="w-full text-sm" aria-label="Beds of the stay">
                <thead>
                  <tr class="border-b border-outline-variant text-left">
                    <th class="py-2 font-medium">Bed</th>
                    <th class="py-2 font-medium">From</th>
                    <th class="py-2 font-medium">To</th>
                    <th class="py-2 text-right font-medium">Rate</th>
                    <th class="py-2 font-medium">Why</th>
                  </tr>
                </thead>
                <tbody>
                  @for (stay of a.stays; track $index) {
                    <tr class="border-b border-outline-variant">
                      <td class="py-1.5">
                        {{ stay.wardName }} · {{ stay.bedCode }}
                        <span class="text-xs">({{ stay.categoryName }})</span>
                      </td>
                      <td class="py-1.5">{{ stay.fromAt | date: 'short' }}</td>
                      <td class="py-1.5">{{ stay.toAt ? (stay.toAt | date: 'short') : 'now' }}</td>
                      <td class="py-1.5 text-right">
                        {{ stay.dailyRate | currency: 'BDT' : 'symbol-narrow' }}
                      </td>
                      <td class="py-1.5">{{ stay.reason }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </section>
          </div>
        </mat-tab>

        <mat-tab label="Account">
          <div class="pt-4">
            @if (store.account(); as account) {
              <div class="mb-4 flex flex-wrap items-center gap-2">
                @if (store.admitted() && store.canBill() && !account.bill) {
                  <button matButton="tonal" type="button" (click)="charge()" [disabled]="store.pending()">
                    <mat-icon>add</mat-icon>
                    Charge
                  </button>
                  <button matButton="tonal" type="button" (click)="advance()" [disabled]="store.pending()">
                    Advance
                  </button>
                  @if (account.held > 0) {
                    <button
                      matButton
                      type="button"
                      (click)="refund(account.held)"
                      [disabled]="store.pending()"
                    >
                      Refund
                    </button>
                  }
                  <button
                    matButton="filled"
                    type="button"
                    (click)="bill(account.total, account.held)"
                    [disabled]="store.pending()"
                  >
                    Make final bill
                  </button>
                }
                @if (account.bill; as bill) {
                  <button
                    matButton="outlined"
                    type="button"
                    (click)="print('hospital.ipd-bill', { admissionId: a.id }, 'bill-' + bill.number)"
                  >
                    <mat-icon>print</mat-icon>
                    Print bill
                  </button>
                  @if (bill.due > 0 && store.canBill()) {
                    <button
                      matButton="tonal"
                      type="button"
                      (click)="collect(bill.id, bill.version, bill.due)"
                      [disabled]="store.pending()"
                    >
                      Collect due
                    </button>
                  }
                  @if (store.admitted() && store.canBill()) {
                    <button
                      matButton
                      type="button"
                      (click)="cancelBill(bill.id, bill.version)"
                      [disabled]="store.pending()"
                    >
                      Cancel bill
                    </button>
                  }
                }
              </div>

              <section class="app-card mb-4 p-5" aria-label="Account totals">
                <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                  <div>
                    <dt class="text-on-surface-variant">Nights</dt>
                    <dd class="text-lg">{{ account.nights }}</dd>
                  </div>
                  <div>
                    <dt class="text-on-surface-variant">Total</dt>
                    <dd class="text-lg">{{ account.total | currency: 'BDT' : 'symbol-narrow' }}</dd>
                  </div>
                  <div>
                    <dt class="text-on-surface-variant">Advance held</dt>
                    <dd class="text-lg">{{ account.held | currency: 'BDT' : 'symbol-narrow' }}</dd>
                  </div>
                  @if (account.bill; as bill) {
                    <div>
                      <dt class="text-on-surface-variant">Bill {{ bill.number }} · due</dt>
                      <dd class="text-lg font-medium">{{ bill.due | currency: 'BDT' : 'symbol-narrow' }}</dd>
                    </div>
                  } @else {
                    <div>
                      <dt class="text-on-surface-variant">Balance</dt>
                      <dd class="text-lg">{{ account.balance | currency: 'BDT' : 'symbol-narrow' }}</dd>
                    </div>
                  }
                </dl>
                <p class="mt-2 text-xs text-on-surface-variant">
                  As of {{ account.asOf }}{{ account.bill ? ' (the bill in force)' : '' }}.
                </p>
              </section>

              <section class="app-card mb-4 overflow-x-auto p-5" aria-labelledby="lines-heading">
                <h2 id="lines-heading" class="mb-3 text-base font-medium">The bill's lines</h2>
                <table class="w-full min-w-[560px] text-sm" aria-label="Bill lines">
                  <tbody>
                    @for (line of account.lines; track $index) {
                      <tr class="border-b border-outline-variant">
                        <td class="py-1.5">
                          {{ line.description }}
                          @if (line.doctorName) {
                            <span class="text-xs"> · {{ line.doctorName }}</span>
                          }
                        </td>
                        <td class="py-1.5 text-right">
                          {{ line.qty }} × {{ line.rate | currency: 'BDT' : 'symbol-narrow' }}
                        </td>
                        <td class="py-1.5 text-right">
                          {{ line.amount | currency: 'BDT' : 'symbol-narrow' }}
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td class="py-2 text-on-surface-variant">Nothing yet.</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </section>

              <div class="grid gap-4 lg:grid-cols-2">
                <section class="app-card overflow-x-auto p-5" aria-labelledby="charges-heading">
                  <h2 id="charges-heading" class="mb-3 text-base font-medium">Charges</h2>
                  <table class="w-full text-sm" aria-label="Charges">
                    <tbody>
                      @for (charge of account.charges; track charge.id) {
                        <tr
                          class="border-b border-outline-variant"
                          [class.line-through]="charge.status === 'cancelled'"
                        >
                          <td class="py-1.5">
                            {{ charge.serviceName }}
                            <div class="text-xs text-on-surface-variant">
                              {{ charge.chargedOn }}{{ charge.doctorName ? ' · ' + charge.doctorName : '' }}
                            </div>
                          </td>
                          <td class="py-1.5 text-right">
                            {{ charge.amount | currency: 'BDT' : 'symbol-narrow' }}
                          </td>
                          <td class="w-10 py-1.5 text-right">
                            @if (
                              charge.status === 'active' &&
                              store.admitted() &&
                              store.canBill() &&
                              !account.bill
                            ) {
                              <button
                                matIconButton
                                type="button"
                                [attr.aria-label]="'Cancel charge ' + charge.serviceName"
                                (click)="cancelCharge(charge.id, charge.serviceName)"
                              >
                                <mat-icon>remove_circle_outline</mat-icon>
                              </button>
                            }
                          </td>
                        </tr>
                      } @empty {
                        <tr>
                          <td class="py-2 text-on-surface-variant">No charges.</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </section>
                <section class="app-card overflow-x-auto p-5" aria-labelledby="payments-heading">
                  <h2 id="payments-heading" class="mb-3 text-base font-medium">Money</h2>
                  <table class="w-full text-sm" aria-label="Payments">
                    <tbody>
                      @for (payment of account.payments; track payment.number) {
                        <tr class="border-b border-outline-variant">
                          <td class="py-1.5">
                            {{ paymentLabels[payment.kind] }} · {{ payment.number }}
                            <div class="text-xs text-on-surface-variant">
                              {{ payment.paidOn }} · {{ payment.method }}
                            </div>
                          </td>
                          <td class="py-1.5 text-right">
                            {{ payment.amount | currency: 'BDT' : 'symbol-narrow' }}
                          </td>
                        </tr>
                      } @empty {
                        <tr>
                          <td class="py-2 text-on-surface-variant">No money in or out.</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </section>
              </div>
            } @else {
              <app-loading-state label="Loading the account…" />
            }
          </div>
        </mat-tab>

        <mat-tab label="Visitor passes">
          <div class="pt-4">
            @if (store.admitted() && store.canAdmit()) {
              <div class="mb-3">
                <button matButton="tonal" type="button" (click)="issuePass()" data-testid="issue-pass">
                  <mat-icon>badge</mat-icon>
                  Issue a pass
                </button>
              </div>
            }
            <ul class="app-card divide-y divide-outline-variant" aria-label="Visitor passes">
              @for (pass of store.passes(); track pass.id) {
                <li class="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
                  <span class="font-mono">{{ pass.number }}</span>
                  <span class="font-medium">{{ pass.visitorName }}</span>
                  <span class="text-on-surface-variant">{{ pass.relation }} {{ pass.mobileNo }}</span>
                  <app-status-badge
                    [label]="pass.valid ? 'In force' : pass.status === 'returned' ? 'Handed back' : 'Ended'"
                    [tone]="pass.valid ? 'success' : 'neutral'"
                  />
                  <span class="ml-auto flex gap-1">
                    @if (pass.valid) {
                      <button
                        matButton
                        type="button"
                        (click)="print('hospital.visitor-pass', { id: pass.id }, pass.number)"
                      >
                        Print
                      </button>
                      @if (store.canAdmit()) {
                        <button matButton type="button" (click)="returnPass(pass)">Handed back</button>
                      }
                    }
                  </span>
                </li>
              } @empty {
                <li class="px-4 py-3 text-sm text-on-surface-variant">No passes.</li>
              }
            </ul>
          </div>
        </mat-tab>
      </mat-tab-group>
    } @else if (store.loading()) {
      <app-loading-state label="Loading the admission…" />
    }
  `,
})
export class AdmissionPage {
  protected readonly store = inject(AdmissionStore);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly notifications = inject(NotificationService);
  private readonly reports = inject(ReportDownloadService);

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statusTones = STATUS_TONES;
  protected readonly kindLabels = KIND_LABELS;
  protected readonly paymentLabels = PAYMENT_LABELS;
  protected readonly subtitle = computed(() => {
    const a = this.store.admission();
    if (!a) return '';
    return [`UHID ${a.uhid}`, a.number, a.bedCode ? `${a.wardName} · ${a.bedCode}` : null, a.doctorName]
      .filter((part) => !!part)
      .join(' · ');
  });

  private readonly api = this.store.api;

  protected dischargeLabel(type: DischargeType | null): string {
    return type ? DISCHARGE_LABELS[type] : '';
  }

  private done(message: string) {
    return (result: unknown) => {
      if (result) this.notifications.success(message);
    };
  }

  protected transfer(): void {
    this.dialog
      .open<BedDialog, BedDialogData>(BedDialog, {
        ...WIDE,
        data: {
          title: 'Move to another bed',
          message: 'The patient moves now; the bed left is made ready by housekeeping.',
          confirmText: 'Move',
          bedOptional: false,
          submit: (bedId, reason) =>
            this.store.change((id, version) => this.api.transfer(id, version, bedId ?? '', reason)),
        },
      })
      .afterClosed()
      .subscribe(this.done('Patient moved.'));
  }

  protected reopen(): void {
    this.dialog
      .open<BedDialog, BedDialogData>(BedDialog, {
        ...WIDE,
        data: {
          title: 'Reopen the admission?',
          message:
            'The discharge is undone and the unpaid final bill cancelled (its advance is held again). A bill already paid stands: admit the patient again instead.',
          confirmText: 'Reopen',
          bedOptional: true,
          submit: (bedId, reason) =>
            this.store.change((id, version) => this.api.reopen(id, version, reason, bedId)),
        },
      })
      .afterClosed()
      .subscribe(this.done('Admission reopened.'));
  }

  protected discharge(): void {
    this.dialog
      .open<DischargeDialog, DischargeDialogData>(DischargeDialog, {
        ...WIDE,
        data: {
          submit: (type, note) =>
            this.store.change((id, version) => this.api.discharge(id, version, type, note)),
        },
      })
      .afterClosed()
      .subscribe(this.done('Patient discharged.'));
  }

  protected correct(): void {
    const admission = this.store.admission();
    if (!admission) return;
    this.dialog
      .open<CorrectDialog, CorrectDialogData>(CorrectDialog, {
        ...WIDE,
        data: {
          admission,
          billed: this.store.billed(),
          submit: (correction) =>
            this.store.change((id, version) => this.api.correct(id, version, correction)),
        },
      })
      .afterClosed()
      .subscribe(this.done('Admission corrected.'));
  }

  protected consultant(): void {
    const admission = this.store.admission();
    const current =
      admission?.doctors.find((doctor) => doctor.role === 'primary' && !doctor.toAt)?.doctorId ?? null;
    this.dialog
      .open<DoctorsDialog, DoctorsDialogData>(DoctorsDialog, {
        ...WIDE,
        data: {
          mode: 'consultant',
          current,
          submit: (doctorId) =>
            this.store.change((id, version) => this.api.consultant(id, version, doctorId)),
        },
      })
      .afterClosed()
      .subscribe(this.done('Consultant changed.'));
  }

  protected additional(): void {
    const current = (this.store.admission()?.doctors ?? [])
      .filter((doctor) => doctor.role === 'additional' && !doctor.toAt)
      .map((doctor) => doctor.doctorId);
    this.dialog
      .open<DoctorsDialog, DoctorsDialogData>(DoctorsDialog, {
        ...WIDE,
        data: {
          mode: 'additional',
          current,
          submit: (doctorIds) =>
            this.store.change((id, version) => this.api.additionalDoctors(id, version, doctorIds)),
        },
      })
      .afterClosed()
      .subscribe(this.done('Doctors saved.'));
  }

  protected cancel(): void {
    this.reason({
      title: 'Cancel the admission?',
      message: 'An admission made by mistake: cancel its charges and refund its advance first.',
      confirmText: 'Cancel admission',
      submit: (reason) => this.store.change((id, version) => this.api.cancel(id, version, reason)),
    }).subscribe(this.done('Admission cancelled.'));
  }

  protected charge(): void {
    this.dialog
      .open<StayChargeDialog, StayChargeDialogData>(StayChargeDialog, {
        ...WIDE,
        data: { submit: (request) => this.store.act((id) => this.api.charge(id, request)) },
      })
      .afterClosed()
      .subscribe(this.done('Charged to the stay.'));
  }

  protected cancelCharge(chargeId: string, name: string): void {
    this.reason({
      title: `Cancel the charge "${name}"?`,
      message: 'It comes off the stay before the final bill.',
      confirmText: 'Cancel charge',
      submit: (reason) => this.store.act((id) => this.api.cancelCharge(id, chargeId, reason)),
    }).subscribe(this.done('Charge cancelled.'));
  }

  protected advance(): void {
    this.money({
      title: 'Take an advance',
      confirmText: 'Take',
      max: null,
      submit: (money) => this.store.act((id) => this.api.advance(id, money)),
    }).subscribe(this.done('Advance taken.'));
  }

  protected refund(held: number): void {
    this.money({
      title: 'Refund advance held',
      confirmText: 'Refund',
      max: held,
      submit: (money) => this.store.act((id) => this.api.refund(id, money)),
    }).subscribe(this.done('Advance refunded.'));
  }

  protected collect(billId: string, version: number, due: number): void {
    this.money({
      title: 'Collect the due',
      confirmText: 'Collect',
      max: due,
      submit: (money) => this.store.act(() => this.api.collect(billId, version, money)),
    }).subscribe(this.done('Due collected.'));
  }

  protected bill(total: number, held: number): void {
    this.dialog
      .open<FinalBillDialog, FinalBillDialogData>(FinalBillDialog, {
        ...WIDE,
        data: {
          total,
          held,
          submit: (request) => {
            let made: { number: string; due: number; receipt: string | null } | null = null;
            return this.store
              .act((id) => this.api.finalBill(id, request).pipe(map((result) => (made = result))))
              .pipe(map(() => made!));
          },
        },
      })
      .afterClosed()
      .subscribe((made) => {
        const bill = made as { number: string; due: number } | undefined;
        if (bill) this.notifications.success(`Final bill ${bill.number} made; ${bill.due.toFixed(2)} due.`);
      });
  }

  protected cancelBill(billId: string, version: number): void {
    this.reason({
      title: 'Cancel the final bill?',
      message: 'What was paid against it is held as advance again. Bill again before the discharge.',
      confirmText: 'Cancel bill',
      submit: (reason) => this.store.act(() => this.api.cancelBill(billId, version, reason)),
    }).subscribe(this.done('Final bill cancelled.'));
  }

  protected issuePass(): void {
    this.dialog
      .open<PassDialog, PassDialogData>(PassDialog, {
        ...WIDE,
        data: {
          submit: (visitor) => {
            let issued: { id: string; number: string } | null = null;
            return this.store
              .act((id) => this.api.issuePass(id, visitor).pipe(map((result) => (issued = result))))
              .pipe(map(() => issued!));
          },
        },
      })
      .afterClosed()
      .subscribe((issued) => {
        const pass = issued as { id: string; number: string } | undefined;
        if (!pass) return;
        this.notifications.success(`Pass ${pass.number} issued.`);
        this.print('hospital.visitor-pass', { id: pass.id }, pass.number);
      });
  }

  protected returnPass(pass: VisitorPass): void {
    this.confirm
      .confirm({
        title: `Pass ${pass.number} handed back?`,
        message: `${pass.visitorName}'s pass is no longer in force; another can be issued.`,
        confirmText: 'Handed back',
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.store.act(() => this.api.returnPass(pass.id))),
      )
      .subscribe({
        next: () => this.notifications.success('Pass handed back.'),
        error: (error: unknown) => this.notifications.error(error),
      });
  }

  protected print(key: string, params: Record<string, unknown>, fileName: string): void {
    this.reports
      .download(key, params, fileName)
      .subscribe({ error: (error: unknown) => this.notifications.error(error) });
  }

  private reason(data: ReasonDialogData): Observable<unknown> {
    return this.dialog
      .open<ReasonDialog, ReasonDialogData, true>(ReasonDialog, { ...WIDE, data })
      .afterClosed();
  }

  private money(data: MoneyDialogData): Observable<unknown> {
    return this.dialog.open<MoneyDialog, MoneyDialogData>(MoneyDialog, { ...WIDE, data }).afterClosed();
  }
}
