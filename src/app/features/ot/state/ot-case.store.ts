import { computed, inject, Injectable, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { finalize, map, Observable, tap } from 'rxjs';
import { Authorization } from '../../../core/authorization/authorization.service';
import { toApiError } from '../../../core/http/api-error';
import type { ChargeRequest, OtClinicalRequest, OtNote } from '../models/ot.models';
import { OtApi } from '../services/ot-api.service';

export type OtAction =
  | 'change'
  | 'schedule'
  | 'start'
  | 'finish'
  | 'cancel'
  | 'note'
  | 'sign'
  | 'charge'
  | 'cancel-charge'
  | 'print';

/**
 * State of one operation's page. Every change sends the version the page last read, so a change made
 * meanwhile by someone else is refused (409) instead of being overwritten; the page then reloads.
 */
@Injectable()
export class OtCaseStore {
  private readonly api = inject(OtApi);
  private readonly authorization = inject(Authorization);

  readonly caseId = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id') ?? '')), {
    requireSync: true,
  });

  private readonly resource = rxResource({
    params: () => this.caseId() || undefined,
    stream: ({ params }) => this.api.get(params),
  });

  readonly otCase = computed(() => (this.resource.hasValue() ? this.resource.value() : null));
  readonly loading = this.resource.isLoading;
  readonly error = computed(() => {
    const error = this.resource.error();
    return error ? toApiError(error) : null;
  });

  readonly status = computed(() => this.otCase()?.status ?? null);
  /** What and who can change until it is done. */
  readonly canChange = computed(
    () =>
      this.authorization.can('ot:request') &&
      (this.status() === 'requested' || this.status() === 'scheduled' || this.status() === 'in_progress'),
  );
  readonly canSchedule = computed(
    () =>
      this.authorization.can('ot:schedule') &&
      (this.status() === 'requested' || this.status() === 'scheduled'),
  );
  readonly canStart = computed(() => this.authorization.can('ot:schedule') && this.status() === 'scheduled');
  readonly canFinish = computed(
    () => this.authorization.can('ot:schedule') && this.status() === 'in_progress',
  );
  readonly canCancel = computed(
    () =>
      this.authorization.can('ot:schedule') &&
      (this.status() === 'requested' || this.status() === 'scheduled'),
  );
  /** The note is written once the operation has started, until it is signed. */
  readonly canWriteNote = computed(
    () =>
      this.authorization.can('ot:note') &&
      (this.status() === 'in_progress' || this.status() === 'done') &&
      !this.otCase()?.noteSignedAt,
  );
  readonly canSign = computed(
    () => this.canWriteNote() && this.status() === 'done' && !!this.otCase()?.procedureDone,
  );
  readonly canCharge = computed(() => this.authorization.can('ipd:bill') && this.status() !== 'cancelled');

  /** The action currently running, so the page can disable buttons and prevent double submits. */
  readonly pending = signal<OtAction | null>(null);

  reload(): void {
    this.resource.reload();
  }

  change(request: OtClinicalRequest): Observable<void> {
    return this.run('change', (id, version) => this.api.change(id, version, request));
  }

  schedule(roomId: string, from: Date, to: Date): Observable<void> {
    return this.run('schedule', (id, version) => this.api.schedule(id, version, roomId, from, to));
  }

  start(at: Date | null): Observable<void> {
    return this.run('start', (id, version) => this.api.move(id, version, 'start', at));
  }

  finish(at: Date | null): Observable<void> {
    return this.run('finish', (id, version) => this.api.move(id, version, 'finish', at));
  }

  cancel(reason: string): Observable<void> {
    return this.run('cancel', (id, version) => this.api.cancel(id, version, reason));
  }

  writeNote(note: OtNote): Observable<void> {
    return this.run('note', (id, version) => this.api.writeNote(id, version, note));
  }

  signNote(): Observable<void> {
    return this.run('sign', (id, version) => this.api.signNote(id, version));
  }

  charge(request: Omit<ChargeRequest, 'otCaseId'>): Observable<void> {
    return this.run('charge', (id) => this.api.charge(this.admissionId(), { ...request, otCaseId: id }));
  }

  cancelCharge(chargeId: string, reason: string): Observable<void> {
    return this.run('cancel-charge', () => this.api.cancelCharge(this.admissionId(), chargeId, reason));
  }

  private admissionId(): string {
    return this.otCase()?.admissionId ?? '';
  }

  private run(
    action: OtAction,
    request: (id: string, version: number) => Observable<unknown>,
  ): Observable<void> {
    const current = this.otCase();
    this.pending.set(action);
    return request(this.caseId(), current?.version ?? 0).pipe(
      map(() => undefined),
      // Reload on success, and on a conflict (409): what the page shows is then stale either way.
      tap({
        next: () => this.resource.reload(),
        error: (error: unknown) => {
          if (toApiError(error).status === 409) this.resource.reload();
        },
      }),
      finalize(() => this.pending.set(null)),
    );
  }
}
