import { HttpClient, HttpEvent, HttpEventType, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { filter, map, Observable, scan } from 'rxjs';
import { ScannedReceipt } from '../models/receipt.model';

export type ScanProgress =
  | { phase: 'uploading'; percent: number }
  | { phase: 'analysing' }
  | { phase: 'done'; receipt: ScannedReceipt };

@Injectable({ providedIn: 'root' })
export class ReceiptService {
  private readonly http = inject(HttpClient);

  /**
   * Uploads a photo and streams progress.
   *
   * Two-phase reporting is deliberate: on a phone the upload itself can take
   * several seconds on a weak connection, and then Gemini takes a few more
   * with no further network events. A single spinner for both looks frozen,
   * so we show real upload percentage first and switch to "analysing" the
   * moment the bytes are away.
   */
  scan(file: File): Observable<ScanProgress> {
    const form = new FormData();
    form.append('image', file, file.name || 'receipt.jpg');

    return this.http
      .post<ScannedReceipt>('/api/receipts/scan', form, {
        reportProgress: true,
        observe: 'events',
        // The scan has its own full-screen overlay; the global bar would be
        // redundant on top of it.
        headers: new HttpHeaders({ 'X-Silent': '1' }),
      })
      .pipe(
        scan((_acc: ScanProgress | null, event: HttpEvent<ScannedReceipt>): ScanProgress | null => {
          if (event.type === HttpEventType.UploadProgress) {
            const percent = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
            return percent >= 100 ? { phase: 'analysing' } : { phase: 'uploading', percent };
          }
          if (event.type === HttpEventType.Sent) {
            return { phase: 'uploading', percent: 0 };
          }
          if (event.type === HttpEventType.Response && event.body) {
            return { phase: 'done', receipt: event.body };
          }
          return _acc;
        }, null),
        filter((progress): progress is ScanProgress => progress !== null),
      );
  }

  /** Convenience for callers that only care about the final result. */
  scanToResult(file: File): Observable<ScannedReceipt> {
    return this.scan(file).pipe(
      filter((p): p is Extract<ScanProgress, { phase: 'done' }> => p.phase === 'done'),
      map((p) => p.receipt),
    );
  }
}
