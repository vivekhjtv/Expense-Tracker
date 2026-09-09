import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

/**
 * Every feature is lazy-loaded. On a phone this matters more than on desktop:
 * the first paint only carries the shell plus the one screen being opened.
 *
 * `authGuard` is applied per-route rather than to a parent layout so the login
 * route can sit at the same level without inheriting it.
 */
export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · Expense Tracker',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: '',
    pathMatch: 'full',
    title: 'Dashboard · Expense Tracker',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'add',
    title: 'Add a Spend · Expense Tracker',
    canActivate: [authGuard],
    loadComponent: () => import('./features/add-expense/add-expense').then((m) => m.AddExpense),
  },
  {
    path: 'edit/:id',
    title: 'Edit · Expense Tracker',
    canActivate: [authGuard],
    loadComponent: () => import('./features/add-expense/add-expense').then((m) => m.AddExpense),
  },
  {
    path: 'transactions',
    title: 'Transactions · Expense Tracker',
    canActivate: [authGuard],
    loadComponent: () => import('./features/transactions/transactions').then((m) => m.Transactions),
  },
  // The screen used to live at /ledger; anything already bookmarked or linked
  // there still lands in the right place.
  { path: 'ledger', pathMatch: 'full', redirectTo: 'transactions' },
  {
    path: 'settings',
    title: 'More · Expense Tracker',
    canActivate: [authGuard],
    loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
  },
  { path: '**', redirectTo: '' },
];
