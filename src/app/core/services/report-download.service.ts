import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { API_BASE_URL } from '../config/api-config';
import { ApiError, toApiError } from '../http/api-error';

export type ReportFormat = 'pdf' | 'xlsx';

/**
 * Runs a backend report (`POST /reports/:key/render`) and saves the file. Which reports a user may run is
 * granted per role on the backend, so a refusal comes back as a normal 403.
 */
@Injectable({ providedIn: 'root' })
export class ReportDownloadService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  download(
    key: string,
    params: Readonly<Record<string, unknown>>,
    fileName: string,
    format: ReportFormat = 'pdf',
  ): Observable<void> {
    return this.http
      .post(
        `${this.baseUrl}/reports/${encodeURIComponent(key)}/render`,
        { format, params },
        { responseType: 'blob' },
      )
      .pipe(
        map((blob) => save(blob, `${fileName}.${format}`)),
        // A blob response hides the problem document, so name the common refusals here.
        catchError((error: unknown) => throwError(() => describe(toApiError(error)))),
      );
  }
}

function describe(error: ApiError): ApiError {
  if (error.status === 403)
    return new ApiError(403, 'report_not_granted', 'You are not allowed to run this report.');
  if (error.status === 404) return new ApiError(404, 'not_found', 'The report or its record was not found.');
  if (error.status === 400 || error.status === 409 || error.status === 422) {
    return new ApiError(error.status, error.code, 'The report cannot be printed for this record.');
  }
  return error;
}

function save(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Give the browser a moment to start the download before the URL is revoked.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
