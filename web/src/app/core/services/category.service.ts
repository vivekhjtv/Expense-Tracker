import { Injectable, computed, signal } from '@angular/core';
import {
  CategoryMeta,
  CATEGORY_OVERRIDES_STORAGE_KEY,
  CUSTOM_CATEGORIES_STORAGE_KEY,
  DELETED_CATEGORIES_STORAGE_KEY,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from '../models/enums';

export interface CategoryOverride {
  readonly label: string;
  readonly icon: string;
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly custom = signal<CategoryMeta[]>(this.readStoredCustom());
  private readonly overrides = signal<Record<string, CategoryOverride>>(
    this.readStoredOverrides(),
  );
  private readonly deleted = signal<string[]>(this.readStoredDeleted());

  readonly customCategories = this.custom.asReadonly();
  readonly categoryOverrides = this.overrides.asReadonly();
  readonly deletedCategories = this.deleted.asReadonly();

  readonly deletedCount = computed(() => this.deleted().length);

  readonly expenseCategories = computed<CategoryMeta[]>(() => {
    const ov = this.overrides();
    const del = new Set(this.deleted());
    const base = EXPENSE_CATEGORIES.filter((c) => !del.has(c.value)).map((c) =>
      this.applyOverride(c, ov),
    );
    const customExpenses = this.custom()
      .filter((c) => !del.has(c.value))
      .filter((c) => (c as any).type !== 'INCOME');
    return [...base, ...customExpenses];
  });

  readonly incomeCategories = computed<CategoryMeta[]>(() => {
    const ov = this.overrides();
    const del = new Set(this.deleted());
    const base = INCOME_CATEGORIES.filter((c) => !del.has(c.value)).map((c) =>
      this.applyOverride(c, ov),
    );
    const customIncome = this.custom()
      .filter((c) => !del.has(c.value))
      .filter((c) => (c as any).type === 'INCOME');
    return [...base, ...customIncome];
  });

  readonly allCategories = computed<CategoryMeta[]>(() => {
    const ov = this.overrides();
    const del = new Set(this.deleted());
    const allBase = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]
      .filter((c) => !del.has(c.value))
      .map((c) => this.applyOverride(c, ov));
    const customAll = this.custom().filter((c) => !del.has(c.value));
    return [...allBase, ...customAll];
  });

  private applyOverride(
    base: CategoryMeta,
    overrides: Record<string, CategoryOverride>,
  ): CategoryMeta {
    const override = overrides[base.value];
    if (override) {
      return {
        ...base,
        label: override.label || base.label,
        icon: override.icon || base.icon,
        isEdited: true,
        originalLabel: base.label,
        originalIcon: base.icon,
      };
    }
    return base;
  }

  private readStoredCustom(): CategoryMeta[] {
    try {
      const raw = localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((c) => ({ ...c, isCustom: true }));
        }
      }
    } catch {
      // ignore
    }
    return [];
  }

  private readStoredOverrides(): Record<string, CategoryOverride> {
    try {
      const raw = localStorage.getItem(CATEGORY_OVERRIDES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return {};
  }

  private readStoredDeleted(): string[] {
    try {
      const raw = localStorage.getItem(DELETED_CATEGORIES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((item) => typeof item === 'string');
        }
      }
    } catch {
      // ignore
    }
    return [];
  }

  private persistCustom(categories: CategoryMeta[]): void {
    try {
      localStorage.setItem(CUSTOM_CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
    } catch {
      // ignore
    }
  }

  private persistOverrides(overrides: Record<string, CategoryOverride>): void {
    try {
      localStorage.setItem(CATEGORY_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
    } catch {
      // ignore
    }
  }

  private persistDeleted(deleted: string[]): void {
    try {
      localStorage.setItem(DELETED_CATEGORIES_STORAGE_KEY, JSON.stringify(deleted));
    } catch {
      // ignore
    }
  }

  addCategory(params: {
    label: string;
    icon?: string;
    type?: 'EXPENSE' | 'INCOME';
  }): CategoryMeta {
    const label = params.label.trim();
    const icon = params.icon?.trim() || '🏷️';
    const baseSlug = label
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 30);
    const slug = baseSlug || 'CUSTOM';

    let value = slug;
    const existing = this.allCategories().map((c) => c.value);
    let counter = 1;
    while (existing.includes(value)) {
      value = `${slug}_${counter++}`;
    }

    // If it was in the deleted list, un-delete it
    if (this.deleted().includes(value)) {
      const updatedDeleted = this.deleted().filter((d) => d !== value);
      this.deleted.set(updatedDeleted);
      this.persistDeleted(updatedDeleted);
    }

    const newCategory: CategoryMeta = {
      value,
      label,
      icon,
      isCustom: true,
      ...(params.type ? { type: params.type } : {}),
    };

    const updated = [...this.custom(), newCategory];
    this.custom.set(updated);
    this.persistCustom(updated);
    return newCategory;
  }

  updateCategory(
    value: string,
    update: { label: string; icon?: string },
  ): CategoryMeta {
    const label = update.label.trim();
    const icon = update.icon?.trim() || '🏷️';

    // 1. Check if it's a custom category
    const customIdx = this.custom().findIndex((c) => c.value === value);
    if (customIdx >= 0) {
      const updated = this.custom().map((c) =>
        c.value === value ? { ...c, label, icon } : c,
      );
      this.custom.set(updated);
      this.persistCustom(updated);
      return updated[customIdx];
    }

    // 2. Otherwise it's a default category override
    const currentOverrides = { ...this.overrides() };
    currentOverrides[value] = { label, icon };
    this.overrides.set(currentOverrides);
    this.persistOverrides(currentOverrides);

    return this.categoryMeta(value);
  }

  resetCategory(value: string): void {
    const currentOverrides = { ...this.overrides() };
    if (currentOverrides[value]) {
      delete currentOverrides[value];
      this.overrides.set(currentOverrides);
      this.persistOverrides(currentOverrides);
    }
  }

  /**
   * Deletes ANY category - works for both custom categories and pre-defined default categories!
   */
  deleteCategory(value: string): void {
    // 1. If custom, remove from custom list
    const wasCustom = this.custom().some((c) => c.value === value);
    if (wasCustom) {
      const updated = this.custom().filter((c) => c.value !== value);
      this.custom.set(updated);
      this.persistCustom(updated);
    }

    // 2. Track in deleted list (completely hides from all views)
    if (!this.deleted().includes(value)) {
      const updatedDeleted = [...this.deleted(), value];
      this.deleted.set(updatedDeleted);
      this.persistDeleted(updatedDeleted);
    }

    // 3. Clear any overrides
    this.resetCategory(value);
  }

  /** Restores a specific category if it was deleted. */
  restoreCategory(value: string): void {
    if (this.deleted().includes(value)) {
      const updatedDeleted = this.deleted().filter((v) => v !== value);
      this.deleted.set(updatedDeleted);
      this.persistDeleted(updatedDeleted);
    }
  }

  /** Restores all deleted default categories. */
  restoreAllDefaults(): void {
    this.deleted.set([]);
    this.persistDeleted([]);
  }

  isCustom(value: string): boolean {
    return this.custom().some((c) => c.value === value);
  }

  isEdited(value: string): boolean {
    return !!this.overrides()[value];
  }

  isDeleted(value: string): boolean {
    return this.deleted().includes(value);
  }

  categoryMeta(value: string | null | undefined): CategoryMeta {
    if (!value) {
      return { value: 'OTHER', label: 'Other', icon: '🏷️' };
    }
    const found = this.allCategories().find((c) => c.value === value);
    if (found) return found;

    // For historical transactions that used a deleted default category:
    const baseDefault = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].find((c) => c.value === value);
    if (baseDefault) {
      return this.applyOverride(baseDefault, this.overrides());
    }

    return {
      value,
      label: value.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      icon: '🏷️',
    };
  }
}
