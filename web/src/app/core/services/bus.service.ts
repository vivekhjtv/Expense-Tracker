import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BusEntry, BusMonth } from '../models/bus.model';

@Injectable({ providedIn: 'root' })
export class BusService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/bus';

  /** @param month "YYYY-MM". */
  month(month: string): Observable<BusMonth> {
    return this.http.get<BusMonth>(this.baseUrl, { params: new HttpParams().set('month', month) });
  }

  /**
   * Records a day's bus ticket price. PUT because a day holds one figure:
   * sending the same day again corrects it rather than adding a second entry.
   */
  save(date: string, price: number): Observable<BusEntry> {
    return this.http.put<BusEntry>(this.baseUrl, { date, price });
  }

  remove(date: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${date}`);
  }
}
