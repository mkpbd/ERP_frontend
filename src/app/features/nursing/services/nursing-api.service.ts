import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api-config';
import { toHttpParams } from '../../../core/http/http-params';
import type {
  Chart,
  Observation,
  ObservationBoard,
  ObservationRequest,
  Order,
  OrderKind,
  OrderRequest,
  VitalFlag,
} from '../models/nursing.models';

/** Data access for the nursing records (`/clinical`): observations, the rounds' board, orders and their charts. */
@Injectable({ providedIn: 'root' })
export class NursingApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/clinical`;

  board(day: string): Observable<ObservationBoard> {
    return this.http.get<ObservationBoard>(`${this.url}/observation-board`, {
      params: toHttpParams({ day }),
    });
  }

  observations(admissionId: string, from: string, to: string): Observable<Observation[]> {
    return this.http
      .get<{ items: Observation[] }>(`${this.admissionUrl(admissionId)}/observations`, {
        params: toHttpParams({ from, to }),
      })
      .pipe(map((response) => response.items));
  }

  record(
    admissionId: string,
    observation: ObservationRequest,
  ): Observable<{ id: string; flags: VitalFlag[] }> {
    return this.http.post<{ id: string; flags: VitalFlag[] }>(
      `${this.admissionUrl(admissionId)}/observations`,
      observation,
    );
  }

  strike(id: string, reason: string): Observable<void> {
    return this.http.post<void>(`${this.url}/observations/${encodeURIComponent(id)}/strike`, { reason });
  }

  orders(admissionId: string): Observable<Order[]> {
    return this.http
      .get<{ items: Order[] }>(`${this.admissionUrl(admissionId)}/orders`)
      .pipe(map((response) => response.items));
  }

  chart(admissionId: string, day: string, kind: OrderKind): Observable<Chart> {
    return this.http.get<Chart>(`${this.admissionUrl(admissionId)}/chart`, {
      params: toHttpParams({ day, kind }),
    });
  }

  order(admissionId: string, request: OrderRequest): Observable<{ id: string }> {
    const schedule = {
      schedule: request.schedule,
      times: request.times,
      intervalHours: request.intervalHours,
      note: request.note,
    };
    if (request.kind === 'care') {
      return this.http.post<{ id: string }>(`${this.admissionUrl(admissionId)}/care-orders`, {
        ...schedule,
        order: request.name,
        instruction: request.dose,
      });
    }
    return this.http.post<{ id: string }>(`${this.admissionUrl(admissionId)}/orders`, {
      ...schedule,
      productId: request.productId,
      drugName: request.productId ? null : request.name,
      dose: request.dose ?? '',
      route: request.route,
    });
  }

  hold(id: string, version: number, reason: string): Observable<unknown> {
    return this.http.post(`${this.orderUrl(id)}/hold`, { version, reason });
  }

  resume(id: string, version: number): Observable<unknown> {
    return this.http.post(`${this.orderUrl(id)}/resume`, { version });
  }

  stop(id: string, version: number, reason: string): Observable<unknown> {
    return this.http.post(`${this.orderUrl(id)}/stop`, { version, reason });
  }

  /** A due time given (or done) or missed; a when-needed dose given now. */
  dose(
    orderId: string,
    dueAt: string | null,
    outcome: 'given' | 'missed',
    reason: string | null,
  ): Observable<unknown> {
    return this.http.post(`${this.orderUrl(orderId)}/doses`, { dueAt, outcome, reason });
  }

  /** The pharmacy's medicines by brand or generic name (needs `rx:read`; two letters at least). */
  medicines(q: string): Observable<{ id: string; name: string; genericName: string }[]> {
    return this.http
      .get<{ items: { id: string; name: string; genericName: string }[] }>(`${this.url}/medicines`, {
        params: toHttpParams({ q }),
      })
      .pipe(map((response) => response.items));
  }

  private admissionUrl(id: string): string {
    return `${this.url}/admissions/${encodeURIComponent(id)}`;
  }

  private orderUrl(id: string): string {
    return `${this.url}/orders/${encodeURIComponent(id)}`;
  }
}
