import { computed, inject, Injectable, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { finalize, map, Observable, tap } from 'rxjs';
import { Authorization } from '../../../core/authorization/authorization.service';
import { toApiError } from '../../../core/http/api-error';
import type { CultureRequest } from '../models/lab.models';
import { LabApi } from '../services/lab-api.service';

export type ResultAction = 'enter' | 'verify' | 'unverify';

/**
 * One result's page: entered in its test's form (values, a culture or written text), verified by someone else. Every
 * change sends the version read; a conflict (409) reloads the page.
 */
@Injectable()
export class LabResultStore {
  private readonly api = inject(LabApi);
  private readonly authorization = inject(Authorization);

  readonly resultId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id') ?? '')),
    {
      requireSync: true,
    },
  );

  private readonly resource = rxResource({
    params: () => this.resultId() || undefined,
    stream: ({ params }) => this.api.result(params),
  });

  readonly result = computed(() => (this.resource.hasValue() ? this.resource.value() : null));
  readonly loading = this.resource.isLoading;
  readonly error = computed(() => {
    const error = this.resource.error();
    return error ? toApiError(error) : null;
  });

  readonly status = computed(() => this.result()?.status ?? null);
  /** Entered or corrected until verified. */
  readonly canEnter = computed(
    () =>
      this.authorization.can('lab:result') && (this.status() === 'pending' || this.status() === 'entered'),
  );
  readonly canVerify = computed(() => this.authorization.can('lab:verify') && this.status() === 'entered');
  readonly canUnverify = computed(() => this.authorization.can('lab:verify') && this.status() === 'verified');

  readonly pending = signal<ResultAction | null>(null);

  reload(): void {
    this.resource.reload();
  }

  enterValues(values: readonly { parameterId: string; value: string | null }[], comment: string | null) {
    return this.run('enter', (id, version) => this.api.enterValues(id, version, values, comment));
  }

  enterCulture(request: CultureRequest) {
    return this.run('enter', (id, version) => this.api.enterCulture(id, version, request));
  }

  enterText(narrative: string, comment: string | null) {
    return this.run('enter', (id, version) => this.api.enterText(id, version, narrative, comment));
  }

  verify() {
    return this.run('verify', (id, version) => this.api.verify(id, version));
  }

  unverify() {
    return this.run('unverify', (id, version) => this.api.unverify(id, version));
  }

  private run(
    action: ResultAction,
    request: (id: string, version: number) => Observable<unknown>,
  ): Observable<void> {
    this.pending.set(action);
    return request(this.resultId(), this.result()?.version ?? 0).pipe(
      map(() => undefined),
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
