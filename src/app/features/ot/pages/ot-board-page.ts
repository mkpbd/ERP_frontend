import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { PageHeader } from '../../../shared/components/page-header';
import { EmptyState, ErrorState } from '../../../shared/components/state-views';
import { StatusBadge } from '../../../shared/components/status-badge';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { RequestOtDialog, type RequestOtDialogData } from '../components/request-ot-dialog';
import { ScheduleOtDialog, type ScheduleOtDialogData } from '../components/schedule-ot-dialog';
import { fromDay, type OtCaseSummary, STATUS_LABELS, STATUS_TONES, toDay } from '../models/ot.models';
import { OtApi } from '../services/ot-api.service';
import { OtBoardStore } from '../state/ot-board.store';

/** Old OT Management's schedule and the room booking calendar: one day, room by room. */
@Component({
  selector: 'app-ot-board-page',
  providers: [OtBoardStore],
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    PageHeader,
    EmptyState,
    ErrorState,
    StatusBadge,
    HasPermissionDirective,
  ],
  template: `
    <app-page-header
      title="Operation theatre"
      subtitle="Each OT room's operations on a day, and those waiting for a room."
    >
      <a matButton="outlined" routerLink="/ot/cases">
        <mat-icon>list</mat-icon>
        All operations
      </a>
      <button
        matButton="filled"
        type="button"
        *appHasPermission="['ot:request', 'ipd:read', 'opd:read']"
        (click)="request()"
        data-testid="ot-request"
      >
        <mat-icon>add</mat-icon>
        Request operation
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
      <span class="ml-auto text-sm text-on-surface-variant">
        {{ store.booked() }} booked · {{ store.board()?.waiting?.length ?? 0 }} waiting
      </span>
    </div>

    <div class="h-1">
      @if (store.loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading the board" />
      }
    </div>

    @if (store.error(); as error) {
      <app-error-state [error]="error" title="Could not load the OT board" (retry)="store.reload()" />
    } @else if (store.board(); as board) {
      @if (board.waiting.length) {
        <section class="app-card mb-4 p-4" aria-labelledby="waiting-heading">
          <h2 id="waiting-heading" class="mb-3 text-base font-medium">Waiting for a room</h2>
          <ul class="flex flex-col divide-y divide-outline-variant">
            @for (item of board.waiting; track item.id) {
              <li class="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                <a [routerLink]="['/ot/cases', item.id]" class="font-medium text-primary hover:underline">{{
                  item.number
                }}</a>
                <span
                  >{{ item.patientName }}
                  <span class="text-on-surface-variant">(UHID {{ item.uhid }})</span></span
                >
                <span>{{ item.operationName }}</span>
                <span class="text-on-surface-variant">{{ item.surgeonName }}</span>
                <span class="text-on-surface-variant">for {{ item.requestedFor | date: 'mediumDate' }}</span>
                <button
                  matButton="tonal"
                  type="button"
                  class="ml-auto"
                  *appHasPermission="'ot:schedule'"
                  (click)="schedule(item)"
                >
                  Schedule
                </button>
              </li>
            }
          </ul>
        </section>
      }

      @if (board.rooms.length === 0) {
        <app-empty-state
          icon="meeting_room"
          title="No OT rooms"
          message="Add the OT rooms in the OT setup before scheduling operations."
        />
      } @else {
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          @for (room of board.rooms; track room.id) {
            <section class="app-card p-4" [attr.aria-label]="room.name">
              <header class="mb-3 flex items-baseline justify-between gap-2">
                <h2 class="text-base font-medium">{{ room.name }}</h2>
                @if (room.floor) {
                  <span class="text-xs text-on-surface-variant">{{ room.floor }}</span>
                }
              </header>
              @if (room.cases.length === 0) {
                <p class="text-sm text-on-surface-variant">Free all day.</p>
              } @else {
                <ol class="flex flex-col gap-2">
                  @for (item of room.cases; track item.id) {
                    <li class="rounded-card border border-outline-variant p-3">
                      <div class="mb-1 flex items-center justify-between gap-2">
                        <span class="font-mono text-sm">
                          {{ item.scheduledFrom | date: 'shortTime' }}–{{
                            item.scheduledTo | date: 'shortTime'
                          }}
                        </span>
                        <app-status-badge [label]="labels[item.status]" [tone]="tones[item.status]" />
                      </div>
                      <a
                        [routerLink]="['/ot/cases', item.id]"
                        class="font-medium text-primary hover:underline"
                        >{{ item.operationName }}</a
                      >
                      <div class="text-sm">{{ item.patientName }} · UHID {{ item.uhid }}</div>
                      <div class="text-xs text-on-surface-variant">
                        {{ item.surgeonName }} · {{ item.number }}
                      </div>
                    </li>
                  }
                </ol>
              }
            </section>
          }
        </div>
      }
    }
  `,
})
export class OtBoardPage {
  protected readonly store = inject(OtBoardStore);
  private readonly api = inject(OtApi);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  protected readonly labels = STATUS_LABELS;
  protected readonly tones = STATUS_TONES;
  protected readonly day = () => fromDay(this.store.day());

  protected pickDay(event: MatDatepickerInputEvent<Date>): void {
    if (event.value) this.store.setDay(toDay(event.value));
  }

  protected request(): void {
    this.dialog
      .open<RequestOtDialog, RequestOtDialogData, { id: string } | true>(RequestOtDialog, {
        data: { mode: 'request' },
        width: '44rem',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result || result === true) return;
        this.notifications.success('Operation requested.');
        void this.router.navigate(['/ot/cases', result.id]);
      });
  }

  protected schedule(item: OtCaseSummary): void {
    this.dialog
      .open<ScheduleOtDialog, ScheduleOtDialogData, true>(ScheduleOtDialog, {
        data: {
          otCase: item,
          // The board lists cases without their version: read it first.
          submit: (roomId, from, to) =>
            this.api.get(item.id).pipe(
              switchMap((current) => this.api.schedule(item.id, current.version, roomId, from, to)),
              map(() => undefined),
            ),
        },
        width: '28rem',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((done) => {
        if (!done) return;
        this.notifications.success('Operation scheduled.');
        this.store.reload();
      });
  }
}
