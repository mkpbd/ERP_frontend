import { Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { finalize } from 'rxjs';
import { Authorization } from '../../../core/authorization/authorization.service';
import { NotificationService } from '../../../core/services/notification.service';
import { MasterTable } from '../../../shared/components/master-table';
import { PageHeader } from '../../../shared/components/page-header';
import type { MasterDefinition } from '../../../shared/models/record-master';
import { WEEKDAY_LABELS } from '../models/diagnostic.models';
import { DiagnosticApi } from '../services/diagnostic-api.service';

const SATURDAY_FIRST = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

/** Old Diag.TestAppointmentSlots: the windows tests are booked into, each with its places a day. */
export const APPOINTMENT_WINDOWS: MasterDefinition = {
  path: 'hospital/test-appointment-windows',
  managePermission: 'diag:manage',
  label: 'Test appointment windows',
  noun: 'window',
  fields: [
    { key: 'label', label: 'Name', kind: 'text', required: true, max: 60, listed: true },
    { key: 'startTime', label: 'Starts (HH:MM)', kind: 'text', required: true, max: 5, listed: true },
    { key: 'endTime', label: 'Ends (HH:MM)', kind: 'text', max: 5, listed: true },
    {
      key: 'capacity',
      label: 'Places a day',
      kind: 'number',
      required: true,
      min: 1,
      maxValue: 999,
      initial: 20,
      listed: true,
    },
    {
      key: 'departmentId',
      label: 'Department',
      kind: 'select',
      lookup: { path: 'hospital/diagnostic-departments', label: 'name' },
      emptyLabel: 'Any department',
      listed: true,
    },
    {
      key: 'displayOrder',
      label: 'Order',
      kind: 'number',
      required: true,
      min: 0,
      maxValue: 999,
      initial: 0,
    },
    { key: 'isActive', label: 'Active', kind: 'toggle', listed: true },
  ],
};

/** Old Diag.HomeCollectionServiceAreas: where collectors go, at what charge, from what order, on which days. */
export const COLLECTION_AREAS: MasterDefinition = {
  path: 'hospital/home-collection-areas',
  managePermission: 'diag:manage',
  label: 'Home collection areas',
  noun: 'area',
  fields: [
    { key: 'name', label: 'Area', kind: 'text', required: true, max: 100, listed: true },
    {
      key: 'charge',
      label: 'Visit charge (৳)',
      kind: 'number',
      required: true,
      min: 0,
      decimals: 2,
      listed: true,
    },
    {
      key: 'minimumOrder',
      label: 'Smallest order (৳)',
      kind: 'number',
      required: true,
      min: 0,
      decimals: 2,
      initial: 0,
      listed: true,
    },
    {
      key: 'days',
      label: 'Days served',
      kind: 'multi',
      options: SATURDAY_FIRST.map((day) => ({ value: day, label: WEEKDAY_LABELS[day]! })),
      emptyLabel: 'Every day',
      listed: true,
    },
    { key: 'isActive', label: 'Active', kind: 'toggle', listed: true },
  ],
};

/** Old Diag.HomeCollectionTimeSlots: the windows a collector can be asked for. */
export const COLLECTION_WINDOWS: MasterDefinition = {
  path: 'hospital/home-collection-windows',
  managePermission: 'diag:manage',
  label: 'Home collection windows',
  noun: 'window',
  fields: [
    {
      key: 'label',
      label: 'Window (as the patient reads it)',
      kind: 'text',
      required: true,
      max: 60,
      listed: true,
    },
    {
      key: 'displayOrder',
      label: 'Order',
      kind: 'number',
      required: true,
      min: 0,
      maxValue: 999,
      initial: 0,
      listed: true,
    },
    { key: 'isActive', label: 'Active', kind: 'toggle', listed: true },
  ],
};

/** Old Admin.CreditCards: bank cards whose holders get a discount on their own diagnostic bills. */
export const CARD_PROVIDERS: MasterDefinition = {
  path: 'hospital/card-providers',
  managePermission: 'diag:manage',
  label: 'Card providers',
  noun: 'card provider',
  fields: [
    { key: 'name', label: 'Card', kind: 'text', required: true, max: 100, listed: true },
    {
      key: 'discountPercent',
      label: 'Discount (%)',
      kind: 'number',
      required: true,
      min: 0,
      maxValue: 100,
      decimals: 2,
      listed: true,
    },
    { key: 'contactNo', label: 'Contact', kind: 'text', max: 40, listed: true },
    { key: 'address', label: 'Address', kind: 'text', max: 300 },
    { key: 'isActive', label: 'Active', kind: 'toggle', listed: true },
  ],
};

/** Old Diag.TestGroupVideos: what to do before a test, for a department's tests or one test, on the portal. */
export const PREPARATIONS: MasterDefinition = {
  path: 'hospital/test-preparations',
  managePermission: 'diag:manage',
  label: 'Preparation guides',
  noun: 'guide',
  fields: [
    { key: 'title', label: 'Title', kind: 'text', required: true, max: 200, listed: true },
    { key: 'titleBn', label: 'Title (Bangla)', kind: 'text', max: 200 },
    {
      key: 'departmentId',
      label: 'For a department',
      kind: 'select',
      lookup: { path: 'hospital/diagnostic-departments', label: 'name' },
      listed: true,
    },
    {
      key: 'testId',
      label: 'Or for one test',
      kind: 'select',
      lookup: { path: 'hospital/diagnostic-tests', label: 'name' },
      listed: true,
    },
    { key: 'instructions', label: 'Instructions', kind: 'textarea', max: 4000, rows: 4 },
    { key: 'instructionsBn', label: 'Instructions (Bangla)', kind: 'textarea', max: 4000, rows: 4 },
    { key: 'videoUrl', label: 'Video link (https://…)', kind: 'text', max: 600 },
    {
      key: 'displayOrder',
      label: 'Order',
      kind: 'number',
      required: true,
      min: 0,
      maxValue: 999,
      initial: 0,
    },
    { key: 'isActive', label: 'Active', kind: 'toggle', listed: true },
  ],
};

/** The test appointment and home collection setup, and the service a visit's charge is billed as. */
@Component({
  selector: 'app-booking-setup-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTabsModule,
    MasterTable,
    PageHeader,
  ],
  template: `
    <app-page-header
      title="Booking setup"
      subtitle="Windows tests are booked into, the areas collectors go to and what a home visit is billed as."
    />
    <mat-tab-group mat-stretch-tabs="false" animationDuration="0ms">
      <mat-tab label="Test windows">
        <div class="pt-4"><app-master-table [definition]="appointmentWindows" /></div>
      </mat-tab>
      <mat-tab label="Collection areas">
        <div class="pt-4"><app-master-table [definition]="areas" /></div>
      </mat-tab>
      <mat-tab label="Collection windows">
        <div class="pt-4"><app-master-table [definition]="collectionWindows" /></div>
      </mat-tab>
      <mat-tab label="Preparation guides">
        <div class="pt-4"><app-master-table [definition]="preparations" /></div>
      </mat-tab>
      <mat-tab label="Card providers">
        <div class="pt-4"><app-master-table [definition]="cards" /></div>
      </mat-tab>
      <mat-tab label="Visit charge">
        <section class="app-card mt-4 max-w-xl p-4" aria-labelledby="service-heading">
          <h2 id="service-heading" class="mb-2 text-base font-medium">Home collection service</h2>
          <p class="mb-4 text-sm text-on-surface-variant">
            A home visit's charge is billed as this service, at the area's charge. It is a test of a
            department of the "other" kind (the old SERVICES group).
          </p>
          <mat-form-field class="w-full">
            <mat-label>Service</mat-label>
            <mat-select [formControl]="serviceId" data-testid="home-service">
              <mat-option [value]="null">Not set</mat-option>
              @for (service of services(); track service.id) {
                <mat-option [value]="service.id">{{ service.name }}</mat-option>
              }
            </mat-select>
            @if (services().length === 0) {
              <mat-hint>Add a department of the "other" kind and a service in it first.</mat-hint>
            }
          </mat-form-field>
          @if (canManage) {
            <button matButton="filled" type="button" [disabled]="saving()" (click)="save()">Save</button>
          }
        </section>
      </mat-tab>
    </mat-tab-group>
  `,
})
export class BookingSetupPage {
  private readonly api = inject(DiagnosticApi);
  private readonly notifications = inject(NotificationService);
  protected readonly canManage = inject(Authorization).can('diag:manage');

  protected readonly appointmentWindows = APPOINTMENT_WINDOWS;
  protected readonly areas = COLLECTION_AREAS;
  protected readonly collectionWindows = COLLECTION_WINDOWS;
  protected readonly preparations = PREPARATIONS;
  protected readonly cards = CARD_PROVIDERS;

  private readonly policy = rxResource({ stream: () => this.api.policy() });
  private readonly departments = rxResource({ stream: () => this.api.departments() });
  private readonly tests = rxResource({ stream: () => this.api.tests('') });
  protected readonly services = computed(() => {
    const other = new Set(
      (this.departments.hasValue() ? this.departments.value() : [])
        .filter((department) => department.kind === 'other')
        .map((department) => department.id),
    );
    return (this.tests.hasValue() ? this.tests.value() : []).filter((test) => other.has(test.departmentId));
  });
  protected readonly serviceId = new FormControl<string | null>({ value: null, disabled: !this.canManage });
  protected readonly saving = signal(false);

  constructor() {
    effect(() => {
      if (this.policy.hasValue()) this.serviceId.setValue(this.policy.value().homeCollectionTestId);
    });
  }

  protected save(): void {
    if (!this.policy.hasValue() || this.saving()) return;
    this.saving.set(true);
    this.api
      .setPolicy({ ...this.policy.value(), homeCollectionTestId: this.serviceId.value })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.notifications.success('Saved.');
          this.policy.reload();
        },
        error: (error: unknown) => this.notifications.error(error),
      });
  }
}
