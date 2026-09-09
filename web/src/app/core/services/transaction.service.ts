import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DateRangePreset, PaymentMode, TransactionType } from '../models/enums';
import { Paginated, Transaction, TransactionPayload } from '../models/transaction.model';

export interface TransactionQuery {
  range?: DateRangePreset;
  from?: string;
  to?: string;
  paymentMode?: PaymentMode;
  type?: TransactionType;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'date' | 'amount';
  sortDir?: 'asc' | 'desc';
}

/**
 * Minutes east of UTC for this device — 330 in India.
 *
 * The API computes "Today"/"This Week" boundaries against this. Omitting it
 * would fall back to UTC on the server and silently drop a 1am spend from the
 * user's "Today", so every query and analytics call sends it.
 */
export function deviceTzOffset(): number {
  return -new Date().getTimezoneOffset();
}

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/transactions';

  list(query: TransactionQuery = {}): Observable<Paginated<Transaction>> {
    return this.http.get<Paginated<Transaction>>(this.baseUrl, { params: this.toParams(query) });
  }

  get(id: string): Observable<Transaction> {
    return this.http.get<Transaction>(`${this.baseUrl}/${id}`);
  }

  create(payload: TransactionPayload): Observable<Transaction> {
    return this.http.post<Transaction>(this.baseUrl, payload);
  }

  update(id: string, payload: Partial<TransactionPayload>): Observable<Transaction> {
    return this.http.patch<Transaction>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }

  private toParams(query: TransactionQuery): HttpParams {
    let params = new HttpParams().set('tzOffset', deviceTzOffset());

    for (const [key, value] of Object.entries(query)) {
      // Empty strings would become `&category=` and filter on a blank value.
      if (value === undefined || value === null || value === '') continue;
      params = params.set(key, String(value));
    }

    return params;
  }
}
