import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MilkEntry, MilkMonth } from '../models/milk.model';

@Injectable({ providedIn: 'root' })
export class MilkService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/milk';

  /** @param month "YYYY-MM". */
  month(month: string): Observable<MilkMonth> {
    return this.http.get<MilkMonth>(this.baseUrl, { params: new HttpParams().set('month', month) });
  }

  /**
   * Records a day's milk. PUT because a day holds one quantity: sending the
   * same day again corrects it rather than adding a second entry.
   */
  save(date: string, quantity: number): Observable<MilkEntry> {
    return this.http.put<MilkEntry>(this.baseUrl, { date, quantity });
  }

  remove(date: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${date}`);
  }
}
