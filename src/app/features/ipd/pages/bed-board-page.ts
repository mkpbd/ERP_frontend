import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { Authorization } from '../../../core/authorization/authorization.service';
import { toApiError } from '../../../core/http/api-error';
import { NotificationService } from '../../../core/services/notification.service';
import { PageHeader } from '../../../shared/components/page-header';
import { ErrorState } from '../../../shared/components/state-views';
import { BED_LABELS, BED_STATUSES, type BedStatus, type BoardBed } from '../models/ipd.models';
import { IpdApi } from '../services/ipd-api.service';

const BED_CLASSES: Record<BedStatus, string> = {
  available: 'border-[light-dark(#2e7d32,#81c784)] bg-[light-dark(#e8f5e9,#10301a)]',
  occupied: 'border-primary bg-primary-container text-on-primary-container',
  housekeeping: 'border-[light-dark(#b26a00,#ffb74d)] bg-[light-dark(#fff3e0,#3a2600)]',
  out_of_order: 'border-outline bg-surface-container-high text-on-surface-variant',
};

/** Old cabin status / house-keeping dashboard: every bed by ward, who is in it, and beds to make ready. */
@Component({
  selector: 'app-bed-board-page',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    PageHeader,
    ErrorState,
  ],
  template: `
    <app-page-header
      title="Bed board"
      subtitle="Every bed by ward: free, occupied, being made ready or out of order."
    >
      <a matButton="outlined" routerLink="/ipd">
        <mat-icon>list</mat-icon>
        Admissions
      </a>
    </app-page-header>

    <div class="h-1">
      @if (board.isLoading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading the bed board" />
      }
    </div>
    @if (error(); as error) {
      <app-error-state [error]="error" title="Could not load the bed board" (retry)="board.reload()" />
    } @else if (view(); as view) {
      <p class="mb-4 flex flex-wrap gap-4 text-sm" aria-label="Beds by status">
        @for (status of statuses; track status) {
          <span
            ><b>{{ view.counts[status] }}</b> {{ labels[status].toLowerCase() }}</span
          >
        }
      </p>
      @for (ward of view.wards; track ward.id) {
        <section class="mb-6" [attr.aria-label]="ward.name">
          <h2 class="mb-2 text-base font-medium">
            {{ ward.name }}
            @if (ward.floor) {
              <span class="text-sm text-on-surface-variant">· {{ ward.floor }}</span>
            }
          </h2>
          <ul class="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
            @for (bed of ward.beds; track bed.id) {
              <li class="rounded-card border-2 p-3 text-sm" [class]="bedClass(bed)">
                <div class="flex items-start justify-between gap-1">
                  <div>
                    <div class="font-bold">{{ bed.code }}</div>
                    <div class="text-xs">{{ bed.categoryName }} · {{ bed.dailyRate }}/night</div>
                  </div>
                  @if (canManage() && bed.status !== 'occupied') {
                    <button
                      matIconButton
                      type="button"
                      [matMenuTriggerFor]="menu"
                      [attr.aria-label]="'Bed ' + bed.code + ' status'"
                    >
                      <mat-icon>more_vert</mat-icon>
                    </button>
                    <mat-menu #menu="matMenu">
                      @if (bed.status !== 'available') {
                        <button mat-menu-item type="button" (click)="setStatus(bed, 'available')">
                          Ready for a patient
                        </button>
                      }
                      @if (bed.status !== 'out_of_order') {
                        <button mat-menu-item type="button" (click)="setStatus(bed, 'out_of_order')">
                          Out of order
                        </button>
                      }
                    </mat-menu>
                  }
                </div>
                @if (bed.admission; as admission) {
                  <a
                    [routerLink]="['/ipd/admissions', admission.id]"
                    class="mt-1 block font-medium hover:underline"
                    >{{ admission.patientName }}</a
                  >
                  <div class="text-xs">
                    UHID {{ admission.uhid }} · since {{ admission.since | date: 'shortDate' }}
                  </div>
                } @else {
                  <div class="mt-1 text-xs">{{ labels[bed.status] }}</div>
                }
              </li>
            }
          </ul>
        </section>
      }
    }
  `,
})
export class BedBoardPage {
  private readonly api = inject(IpdApi);
  private readonly notifications = inject(NotificationService);
  private readonly authorization = inject(Authorization);

  protected readonly statuses = BED_STATUSES;
  protected readonly labels = BED_LABELS;
  protected readonly board = rxResource({ stream: () => this.api.bedBoard() });
  protected readonly view = computed(() => (this.board.hasValue() ? this.board.value() : null));
  protected readonly error = computed(() => {
    const error = this.board.error();
    return error ? toApiError(error) : null;
  });
  protected readonly canManage = computed(() => this.authorization.can('ipd:manage'));

  protected bedClass(bed: BoardBed): string {
    return BED_CLASSES[bed.status];
  }

  protected setStatus(bed: BoardBed, status: 'available' | 'out_of_order'): void {
    this.api.setBedStatus(bed.id, status).subscribe({
      next: () => {
        this.notifications.success(`Bed ${bed.code}: ${BED_LABELS[status].toLowerCase()}.`);
        this.board.reload();
      },
      error: (error: unknown) => this.notifications.error(error),
    });
  }
}
