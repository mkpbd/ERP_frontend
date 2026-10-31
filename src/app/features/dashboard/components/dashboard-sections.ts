import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { toApiError } from '../../../core/http/api-error';
import { ErrorState } from '../../../shared/components/state-views';
import {
  changePercent,
  type DashboardHead,
  type DayRange,
  formatFigure,
  type Preset,
  PRESET_LABELS,
  PRESETS,
  presetRange,
  toDay,
} from '../models/dashboard.models';
import { DashboardApi } from '../services/dashboard-api.service';
import { BreakdownDialog, type BreakdownDialogData } from './breakdown-dialog';

/**
 * The hospital's figures (old management and department dashboards): each section the user may see, every figure
 * against the days before, and a click for its split.
 */
@Component({
  selector: 'app-dashboard-sections',
  imports: [
    MatButtonToggleModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
    ErrorState,
  ],
  template: `
    @if (visible()) {
      <section class="mb-6" aria-labelledby="figures-heading">
        <div class="mb-3 flex flex-wrap items-center gap-3">
          <h2 id="figures-heading" class="mr-auto text-lg font-medium">Figures</h2>
          <mat-button-toggle-group
            aria-label="Days"
            [value]="preset()"
            (change)="choose($event.value)"
            hideSingleSelectionIndicator
          >
            @for (key of presets; track key) {
              <mat-button-toggle [value]="key">{{ labels[key] }}</mat-button-toggle>
            }
          </mat-button-toggle-group>
          <mat-form-field class="app-dense w-64" subscriptSizing="dynamic">
            <mat-label>Days</mat-label>
            <mat-date-range-input [rangePicker]="picker">
              <input
                matStartDate
                placeholder="From"
                [value]="start()"
                (dateChange)="pickStart($event.value)"
              />
              <input matEndDate placeholder="To" [value]="end()" (dateChange)="pickEnd($event.value)" />
            </mat-date-range-input>
            <mat-datepicker-toggle matIconSuffix [for]="picker" />
            <mat-date-range-picker #picker />
          </mat-form-field>
        </div>
        <div class="h-1">
          @if (overview.isLoading()) {
            <mat-progress-bar mode="indeterminate" aria-label="Loading the figures" />
          }
        </div>
        @if (error(); as error) {
          <app-error-state [error]="error" title="Could not load the figures" (retry)="overview.reload()" />
        } @else if (view(); as view) {
          <p class="mb-3 text-xs text-on-surface-variant">
            Compared with {{ span(view.previousFrom, view.previousTo) }}.
          </p>
          @for (section of view.sections; track section.key) {
            <section class="app-card mb-4 p-4" [attr.aria-labelledby]="'section-' + section.key">
              <h3 [id]="'section-' + section.key" class="mb-3 font-medium">{{ section.title }}</h3>
              <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                @for (head of section.heads; track head.key) {
                  <li>
                    <button
                      type="button"
                      class="h-full w-full rounded-card border border-outline-variant p-3 text-left hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary"
                      [attr.data-testid]="'head-' + head.key"
                      [attr.aria-label]="head.label + ': ' + figure(head) + '. Show its split'"
                      [matTooltip]="head.hint ?? ''"
                      [matTooltipDisabled]="!head.hint"
                      (click)="open(head)"
                    >
                      <div class="text-xs text-on-surface-variant">
                        {{ head.label }}
                        @if (head.current) {
                          <span class="ml-1 rounded-pill bg-surface-container-high px-1.5">now</span>
                        }
                      </div>
                      <div class="mt-1 text-xl font-medium tabular-nums">{{ figure(head) }}</div>
                      @if (change(head); as change) {
                        <div class="text-xs" [class]="change.tone">
                          <mat-icon class="!h-4 !w-4 align-middle !text-base" aria-hidden="true">{{
                            change.icon
                          }}</mat-icon>
                          {{ change.text }}
                        </div>
                      }
                    </button>
                  </li>
                }
              </ul>
            </section>
          }
        }
      </section>
    }
  `,
})
export class DashboardSections {
  private readonly api = inject(DashboardApi);
  private readonly dialog = inject(MatDialog);

  protected readonly presets = PRESETS;
  protected readonly labels = PRESET_LABELS;
  protected readonly preset = signal<Preset | null>('today');
  protected readonly range = signal<DayRange>(presetRange('today'));
  protected readonly start = computed(() => new Date(`${this.range().from}T00:00:00`));
  protected readonly end = computed(() => new Date(`${this.range().to}T00:00:00`));

  protected readonly overview = rxResource({
    params: () => this.range(),
    stream: ({ params }) => this.api.overview(params),
  });
  protected readonly view = computed(() => (this.overview.hasValue() ? this.overview.value() : null));
  protected readonly error = computed(() => {
    const error = this.overview.error();
    return error ? toApiError(error) : null;
  });
  /** Hidden for someone with no section to see, once that is known. */
  protected readonly visible = computed(
    () => this.error() !== null || (this.view()?.sections.length ?? 1) > 0,
  );

  protected choose(preset: Preset): void {
    this.preset.set(preset);
    this.range.set(presetRange(preset));
  }

  protected pickStart(date: Date | null): void {
    if (!date) return;
    // The end follows when the range would run backwards; the picker sets it next.
    const from = toDay(date);
    this.preset.set(null);
    this.range.update((range) => ({ from, to: range.to < from ? from : range.to }));
  }

  protected pickEnd(date: Date | null): void {
    if (!date) return;
    this.preset.set(null);
    this.range.update((range) => ({ ...range, to: toDay(date) }));
  }

  protected figure(head: DashboardHead): string {
    return formatFigure(head.value, head.unit);
  }

  protected change(head: DashboardHead): { text: string; icon: string; tone: string } | null {
    if (head.current) return null;
    const percent = changePercent(head.value, head.previous);
    if (percent === null) {
      return head.previous === 0 && head.value !== 0
        ? { text: 'none before', icon: 'trending_up', tone: 'text-on-surface-variant' }
        : null;
    }
    if (percent === 0)
      return { text: 'same as before', icon: 'trending_flat', tone: 'text-on-surface-variant' };
    return percent > 0
      ? { text: `${percent}% up`, icon: 'trending_up', tone: 'text-[light-dark(#0b5a1d,#a7e8b4)]' }
      : { text: `${-percent}% down`, icon: 'trending_down', tone: 'text-error' };
  }

  protected span(from: string, to: string): string {
    return from === to ? from : `${from} to ${to}`;
  }

  protected open(head: DashboardHead): void {
    this.dialog.open<BreakdownDialog, BreakdownDialogData>(BreakdownDialog, {
      width: '40rem',
      maxWidth: '95vw',
      data: { head, range: this.range() },
    });
  }
}
