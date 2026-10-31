import { computed, inject, Injectable, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { finalize, map, Observable, tap } from 'rxjs';
import { Authorization } from '../../../core/authorization/authorization.service';
import { toApiError } from '../../../core/http/api-error';
import { LabApi } from '../services/lab-api.service';

export type SampleAction = 'receive' | 'reject' | 'deliver';

/** One sample's page: taken in by the lab, rejected with a reason, its verified reports printed and handed over. */
@Injectable()
export class LabSampleStore {
  private readonly api = inject(LabApi);
  private readonly authorization = inject(Authorization);

  readonly sampleId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id') ?? '')),
    {
      requireSync: true,
    },
  );

  private readonly resource = rxResource({
    params: () => this.sampleId() || undefined,
    stream: ({ params }) => this.api.sample(params),
  });

  readonly sample = computed(() => (this.resource.hasValue() ? this.resource.value() : null));
  readonly loading = this.resource.isLoading;
  readonly error = computed(() => {
    const error = this.resource.error();
    return error ? toApiError(error) : null;
  });

  private readonly canWork = computed(() => this.authorization.can('lab:result'));
  readonly canReceive = computed(() => this.canWork() && this.sample()?.status === 'collected');
  readonly canReject = computed(() => this.canWork() && this.sample()?.status !== 'rejected');
  /** Handed over when something of it is verified and not yet handed over. */
  readonly canDeliver = computed(
    () => this.canWork() && (this.sample()?.results.some((result) => result.status === 'verified') ?? false),
  );
  readonly printable = computed(() => (this.sample()?.verified ?? 0) > 0);

  readonly pending = signal<SampleAction | null>(null);

  reload(): void {
    this.resource.reload();
  }

  receive() {
    return this.run('receive', (id, version) => this.api.receive(id, version));
  }

  reject(reason: string) {
    return this.run('reject', (id, version) => this.api.reject(id, version, reason));
  }

  deliver(to: string) {
    return this.run('deliver', (id, version) => this.api.deliver(id, version, to));
  }

  private run(
    action: SampleAction,
    request: (id: string, version: number) => Observable<unknown>,
  ): Observable<void> {
    this.pending.set(action);
    return request(this.sampleId(), this.sample()?.version ?? 0).pipe(
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
