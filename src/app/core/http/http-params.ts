import { HttpParams } from '@angular/common/http';

type ParamValue = string | number | boolean | Date | null | undefined;

/** Builds HttpParams from a flat object, skipping null, undefined and empty strings. */
export function toHttpParams(query: Readonly<Record<string, ParamValue>>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue;
    params = params.set(key, value instanceof Date ? value.toISOString() : String(value));
  }
  return params;
}
