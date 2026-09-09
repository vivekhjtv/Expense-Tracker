import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DateRangePreset } from '../models/enums';
import { DashboardData } from '../models/analytics.model';
import { deviceTzOffset } from './transaction.service';

export interface AnalyticsQuery {
  range?: DateRangePreset;
  from?: string;
  to?: string;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);

  /**
   * One request fills the whole dashboard.
   *
   * The API runs the four pipelines in parallel server-side; four separate
   * calls from a phone would pay four round trips on a mobile connection to
   * get the same bytes.
   */
  dashboard(query: AnalyticsQuery = {}): Observable<DashboardData> {
    let params = new HttpParams().set('tzOffset', deviceTzOffset());

    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params = params.set(key, String(value));
    }

    return this.http.get<DashboardData>('/api/analytics/dashboard', { params });
  }
}
