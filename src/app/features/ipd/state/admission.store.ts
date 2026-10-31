import { computed, inject, Injectable, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { finalize, map, Observable, tap } from 'rxjs';
import { Authorization } from '../../../core/authorization/authorization.service';
import { toApiError } from '../../../core/http/api-error';
import { IpdApi } from '../services/ipd-api.service';

/**
 * One admission's page: the stay, its account and its visitor passes. Changes to the stay send the version read (a
 * conflict reloads); changes to the account reload the account and the stay.
 */
@Injectable()
export class AdmissionStore {
  readonly api = inject(IpdApi);
  private readonly authorization = inject(Authorization);

  readonly admissionId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id') ?? '')),
    {
      requireSync: true,
    },
  );

  private readonly admissionResource = rxResource({
    params: () => this.admissionId() || undefined,
    stream: ({ params }) => this.api.admission(params),
  });
  private readonly accountResource = rxResource({
    params: () => (this.admissionId() && this.authorization.can('ipd:read') ? this.admissionId() : undefined),
    stream: ({ params }) => this.api.account(params),
  });
  private readonly passesResource = rxResource({
    params: () => this.admissionId() || undefined,
    stream: ({ params }) => this.api.passes(params),
  });

  readonly admission = computed(() =>
    this.admissionResource.hasValue() ? this.admissionResource.value() : null,
  );
  readonly account = computed(() => (this.accountResource.hasValue() ? this.accountResource.value() : null));
  readonly passes = computed(() => (this.passesResource.hasValue() ? this.passesResource.value() : []));
  readonly loading = this.admissionResource.isLoading;
  readonly error = computed(() => {
    const error = this.admissionResource.error();
    return error ? toApiError(error) : null;
  });

  readonly status = computed(() => this.admission()?.status ?? null);
  readonly admitted = computed(() => this.status() === 'admitted');
  readonly billed = computed(() => !!this.account()?.bill);
  readonly canAdmit = computed(() => this.authorization.can('ipd:admit'));
  readonly canManage = computed(() => this.authorization.can('ipd:manage'));
  readonly canBill = computed(() => this.authorization.can('ipd:bill'));

  readonly pending = signal(false);

  reload(): void {
    this.admissionResource.reload();
    this.accountResource.reload();
    this.passesResource.reload();
  }

  /** A change to the stay on its current version. */
  change(request: (id: string, version: number) => Observable<unknown>): Observable<void> {
    return this.run(request(this.admissionId(), this.admission()?.version ?? 0));
  }

  /** A change to the account or the passes. */
  act(request: (id: string) => Observable<unknown>): Observable<void> {
    return this.run(request(this.admissionId()));
  }

  private run(request: Observable<unknown>): Observable<void> {
    this.pending.set(true);
    return request.pipe(
      map(() => undefined),
      tap({
        next: () => this.reload(),
        error: (error: unknown) => {
          if (toApiError(error).status === 409) this.reload();
        },
      }),
      finalize(() => this.pending.set(false)),
    );
  }
}
