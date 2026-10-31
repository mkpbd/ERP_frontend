import { Component, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { debounceTime, distinctUntilChanged, finalize, map, Observable, Subject, switchMap } from 'rxjs';
import { toApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/services/notification.service';
import { OptionPicker, type PickerOption } from '../../../shared/components/option-picker';
import { ValidationMessagePipe } from '../../../shared/pipes/validation-message.pipe';
import {
  type OtCase,
  type OtClinicalRequest,
  OT_TEAM_ROLES,
  type OtTeamRole,
  ROLE_LABELS,
  type AdmissionOption,
  toDay,
} from '../models/ot.models';
import { OtApi } from '../services/ot-api.service';

/** Asking for an operation (with the stay and the day), or changing what and who of one already asked for. */
export type RequestOtDialogData =
  | { readonly mode: 'request' }
  | {
      readonly mode: 'change';
      readonly otCase: OtCase;
      readonly submit: (request: OtClinicalRequest) => Observable<void>;
    };

const MAX_TEAM = 10;

type TeamMemberForm = FormGroup<{ doctorId: FormControl<string | null>; role: FormControl<OtTeamRole> }>;

@Component({
  selector: 'app-request-ot-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    OptionPicker,
    ValidationMessagePipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.mode === 'request' ? 'Request an operation' : 'Change the operation' }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content class="flex flex-col gap-1">
        @if (error()) {
          <p
            class="mb-3 rounded-card bg-error-container px-4 py-3 text-sm text-on-error-container"
            role="alert"
          >
            {{ error() }}
          </p>
        }
        @if (data.mode === 'request') {
          <app-option-picker
            label="Admitted patient"
            placeholder="Name, UHID or admission number"
            [options]="admissionOptions()"
            [required]="true"
            (lookup)="admissionSearch.next($event)"
            [formControl]="admissionId"
            testId="ot-admission"
          />
          <mat-form-field>
            <mat-label>Operation day</mat-label>
            <input matInput [matDatepicker]="dayPicker" [min]="today" [formControl]="requestedFor" required />
            <mat-datepicker-toggle matIconSuffix [for]="dayPicker" />
            <mat-datepicker #dayPicker />
            <mat-error>{{ requestedFor.errors | validationMessage: 'Operation day' }}</mat-error>
          </mat-form-field>
        } @else {
          <p class="mb-3 text-sm text-on-surface-variant">
            {{ data.otCase.number }} · {{ data.otCase.patientName }} (UHID {{ data.otCase.uhid }})
          </p>
        }

        <app-option-picker
          label="Operation"
          [options]="operationOptions()"
          [required]="true"
          formControlName="operationId"
          testId="ot-operation"
        />
        <div class="grid gap-x-3 sm:grid-cols-2">
          <mat-form-field>
            <mat-label>OT type</mat-label>
            <mat-select formControlName="otTypeId">
              <mat-option [value]="null">—</mat-option>
              @for (option of otTypes(); track option.id) {
                <mat-option [value]="option.id">{{ option.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Anaesthesia</mat-label>
            <mat-select formControlName="anaesthesiaTypeId">
              <mat-option [value]="null">—</mat-option>
              @for (option of anaesthesiaTypes(); track option.id) {
                <mat-option [value]="option.id">{{ option.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
        <div class="grid gap-x-3 sm:grid-cols-2">
          <app-option-picker
            label="Surgeon"
            [options]="doctorOptions()"
            [required]="true"
            formControlName="surgeonId"
            testId="ot-surgeon"
          />
          <app-option-picker
            label="Anaesthetist"
            [options]="doctorOptions()"
            formControlName="anaesthetistId"
          />
        </div>

        <fieldset class="mb-2">
          <legend class="mb-2 text-sm font-medium">Team</legend>
          @for (member of team.controls; track member; let i = $index) {
            <div class="grid grid-cols-[1fr_auto] gap-x-2 sm:grid-cols-[1fr_12rem_auto]" [formGroup]="member">
              <app-option-picker
                [label]="'Doctor ' + (i + 1)"
                [options]="doctorOptions()"
                formControlName="doctorId"
              />
              <mat-form-field class="col-span-1 sm:col-span-1">
                <mat-label>Role</mat-label>
                <mat-select formControlName="role">
                  @for (role of roles; track role) {
                    <mat-option [value]="role">{{ roleLabels[role] }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <button
                matIconButton
                type="button"
                class="mt-2"
                [attr.aria-label]="'Remove doctor ' + (i + 1)"
                (click)="team.removeAt(i)"
              >
                <mat-icon>remove_circle_outline</mat-icon>
              </button>
            </div>
          }
          @if (team.length < maxTeam) {
            <button matButton type="button" (click)="addMember()">
              <mat-icon>person_add</mat-icon>
              Add to the team
            </button>
          }
        </fieldset>

        <mat-form-field class="w-full">
          <mat-label>Indication</mat-label>
          <textarea matInput formControlName="indication" rows="2"></textarea>
          <mat-error>{{ form.controls.indication.errors | validationMessage: 'Indication' }}</mat-error>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="submitting()">Cancel</button>
        <button matButton="filled" type="submit" [disabled]="submitting()" data-testid="ot-request-submit">
          {{ data.mode === 'request' ? 'Request' : 'Save' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class RequestOtDialog {
  protected readonly data = inject<RequestOtDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(OtApi);
  private readonly dialogRef = inject<MatDialogRef<RequestOtDialog, { id: string } | true>>(MatDialogRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly roles = OT_TEAM_ROLES;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly maxTeam = MAX_TEAM;
  protected readonly today = new Date(new Date().setHours(0, 0, 0, 0));

  protected readonly admissionId = new FormControl<string | null>(null, Validators.required);
  protected readonly requestedFor = new FormControl<Date | null>(this.today, Validators.required);
  protected readonly form = this.fb.group({
    operationId: new FormControl<string | null>(null, Validators.required),
    otTypeId: new FormControl<string | null>(null),
    anaesthesiaTypeId: new FormControl<string | null>(null),
    surgeonId: new FormControl<string | null>(null, Validators.required),
    anaesthetistId: new FormControl<string | null>(null),
    indication: ['', Validators.maxLength(500)],
    team: this.fb.array<TeamMemberForm>([]),
  });
  protected readonly team = this.form.controls.team;

  protected readonly admissionSearch = new Subject<string>();
  private readonly admissions = signal<readonly AdmissionOption[]>([]);
  protected readonly admissionOptions = computed<PickerOption[]>(() =>
    this.admissions().map((admission) => ({
      id: admission.id,
      label: `${admission.patientName} · UHID ${admission.uhid}`,
      hint: [admission.number, admission.wardName, admission.bedCode].filter(Boolean).join(' · '),
    })),
  );

  private readonly operations = rxResource({ stream: () => this.api.operations() });
  private readonly otTypesResource = rxResource({ stream: () => this.api.otTypes() });
  private readonly anaesthesiaResource = rxResource({ stream: () => this.api.anaesthesiaTypes() });
  private readonly doctors = rxResource({ stream: () => this.api.doctors() });

  protected readonly operationOptions = computed<PickerOption[]>(() =>
    (this.operations.hasValue() ? this.operations.value() : []).map((option) => ({
      id: option.id,
      label: option.name,
    })),
  );
  protected readonly otTypes = computed(() =>
    this.otTypesResource.hasValue() ? this.otTypesResource.value() : [],
  );
  protected readonly anaesthesiaTypes = computed(() =>
    this.anaesthesiaResource.hasValue() ? this.anaesthesiaResource.value() : [],
  );
  protected readonly doctorOptions = computed<PickerOption[]>(() =>
    (this.doctors.hasValue() ? this.doctors.value() : []).map((doctor) => ({
      id: doctor.id,
      label: doctor.name,
      hint: doctor.degrees,
    })),
  );

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.admissionSearch
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => this.api.admitted(q)),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (admissions) => this.admissions.set(admissions),
        error: (error: unknown) => this.error.set(describeError(toApiError(error))),
      });
    if (this.data.mode === 'change') {
      const current = this.data.otCase;
      for (const member of current.team) this.team.push(this.member(member.doctorId, member.role));
      this.form.patchValue({
        operationId: current.operationId,
        otTypeId: current.otTypeId,
        anaesthesiaTypeId: current.anaesthesiaTypeId,
        surgeonId: current.surgeonId,
        anaesthetistId: current.anaesthetistId,
        indication: current.indication ?? '',
      });
    } else {
      this.admissionSearch.next('');
    }
  }

  protected addMember(): void {
    this.team.push(this.member(null, 'assistant'));
  }

  private member(doctorId: string | null, role: OtTeamRole): TeamMemberForm {
    return new FormGroup({
      doctorId: new FormControl<string | null>(doctorId, Validators.required),
      role: new FormControl<OtTeamRole>(role, { nonNullable: true }),
    });
  }

  protected submit(): void {
    if (this.submitting()) return;
    const requestMode = this.data.mode === 'request';
    if (this.form.invalid || (requestMode && (this.admissionId.invalid || this.requestedFor.invalid))) {
      this.form.markAllAsTouched();
      this.requestedFor.markAsTouched();
      this.error.set('Fill in the patient, the operation and the surgeon (and a doctor for each team row).');
      return;
    }
    const value = this.form.getRawValue();
    const clinical: OtClinicalRequest = {
      operationId: value.operationId ?? '',
      otTypeId: value.otTypeId,
      anaesthesiaTypeId: value.anaesthesiaTypeId,
      surgeonId: value.surgeonId ?? '',
      anaesthetistId: value.anaesthetistId,
      indication: value.indication.trim() || null,
      team: value.team.map((member) => ({ doctorId: member.doctorId ?? '', role: member.role })),
    };
    const request$: Observable<{ id: string } | true> =
      this.data.mode === 'request'
        ? this.api.request({
            ...clinical,
            admissionId: this.admissionId.value ?? '',
            requestedFor: toDay(this.requestedFor.value ?? this.today),
          })
        : this.data.submit(clinical).pipe(map(() => true as const));

    this.submitting.set(true);
    this.error.set(null);
    this.dialogRef.disableClose = true;
    request$
      .pipe(
        finalize(() => {
          this.submitting.set(false);
          this.dialogRef.disableClose = false;
        }),
      )
      .subscribe({
        next: (result) => this.dialogRef.close(result),
        error: (error: unknown) => this.error.set(describeError(toApiError(error))),
      });
  }
}
