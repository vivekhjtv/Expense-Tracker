import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CategoryService } from './category.service';
import {
  CATEGORY_OVERRIDES_STORAGE_KEY,
  CUSTOM_CATEGORIES_STORAGE_KEY,
  DELETED_CATEGORIES_STORAGE_KEY,
} from '../models/enums';

describe('CategoryService', () => {
  let service: CategoryService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    service = TestBed.inject(CategoryService);
  });

  it('initializes with default categories when no custom categories are stored', () => {
    expect(service.customCategories().length).toBe(0);
    expect(service.expenseCategories().length).toBe(15);
  });

  it('adds a new category and persists it to localStorage', () => {
    const created = service.addCategory({ label: 'Gym & Fitness', icon: '🏋️' });
    expect(created.label).toBe('Gym & Fitness');
    expect(created.icon).toBe('🏋️');
    expect(created.isCustom).toBe(true);
    expect(created.value).toBe('GYM_FITNESS');

    expect(service.customCategories().length).toBe(1);
    expect(service.expenseCategories().some((c) => c.value === 'GYM_FITNESS')).toBe(true);

    const stored = JSON.parse(localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY) || '[]');
    expect(stored.length).toBe(1);
    expect(stored[0].label).toBe('Gym & Fitness');
  });

  it('updates an existing custom category', () => {
    const created = service.addCategory({ label: 'Pets', icon: '🐶' });
    service.updateCategory(created.value, { label: 'Pet Care', icon: '🐱' });

    const updated = service.customCategories().find((c) => c.value === created.value);
    expect(updated?.label).toBe('Pet Care');
    expect(updated?.icon).toBe('🐱');
  });

  it('deletes a custom category and updates localStorage', () => {
    const created = service.addCategory({ label: 'Books', icon: '📚' });
    expect(service.customCategories().length).toBe(1);

    service.deleteCategory(created.value);
    expect(service.customCategories().length).toBe(0);

    const stored = JSON.parse(localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY) || '[]');
    expect(stored.length).toBe(0);
  });

  it('deletes pre-defined default categories (e.g. SUBSCRIPTIONS, INVESTMENTS) and can restore them', () => {
    expect(service.expenseCategories().some((c) => c.value === 'SUBSCRIPTIONS')).toBe(true);
    expect(service.expenseCategories().some((c) => c.value === 'INVESTMENTS')).toBe(true);

    // Delete SUBSCRIPTIONS
    service.deleteCategory('SUBSCRIPTIONS');
    expect(service.expenseCategories().some((c) => c.value === 'SUBSCRIPTIONS')).toBe(false);
    expect(service.allCategories().some((c) => c.value === 'SUBSCRIPTIONS')).toBe(false);

    // Delete INVESTMENTS
    service.deleteCategory('INVESTMENTS');
    expect(service.expenseCategories().some((c) => c.value === 'INVESTMENTS')).toBe(false);
    expect(service.deletedCategories().includes('SUBSCRIPTIONS')).toBe(true);
    expect(service.deletedCategories().includes('INVESTMENTS')).toBe(true);
    expect(service.deletedCount()).toBe(2);

    const stored = JSON.parse(localStorage.getItem(DELETED_CATEGORIES_STORAGE_KEY) || '[]');
    expect(stored).toContain('SUBSCRIPTIONS');
    expect(stored).toContain('INVESTMENTS');

    // Restore all defaults
    service.restoreAllDefaults();
    expect(service.deletedCount()).toBe(0);
    expect(service.expenseCategories().some((c) => c.value === 'SUBSCRIPTIONS')).toBe(true);
    expect(service.expenseCategories().some((c) => c.value === 'INVESTMENTS')).toBe(true);
  });

  it('updates a built-in category and persists override to localStorage', () => {
    service.updateCategory('GROCERIES', { label: 'Kirana & Groceries', icon: '🥦' });

    const meta = service.categoryMeta('GROCERIES');
    expect(meta.label).toBe('Kirana & Groceries');
    expect(meta.icon).toBe('🥦');
    expect(meta.isEdited).toBe(true);

    const stored = JSON.parse(localStorage.getItem(CATEGORY_OVERRIDES_STORAGE_KEY) || '{}');
    expect(stored['GROCERIES']?.label).toBe('Kirana & Groceries');
    expect(stored['GROCERIES']?.icon).toBe('🥦');

    // Resetting it restores original
    service.resetCategory('GROCERIES');
    const resetMeta = service.categoryMeta('GROCERIES');
    expect(resetMeta.label).toBe('Groceries');
    expect(resetMeta.icon).toBe('🛒');
    expect(resetMeta.isEdited).toBeFalsy();
  });

  it('resolves categoryMeta for both built-in and custom categories', () => {
    const created = service.addCategory({ label: 'Coffee', icon: '☕' });

    const customMeta = service.categoryMeta(created.value);
    expect(customMeta.label).toBe('Coffee');
    expect(customMeta.icon).toBe('☕');

    const defaultMeta = service.categoryMeta('GROCERIES');
    expect(defaultMeta.label).toBe('Groceries');
    expect(defaultMeta.icon).toBe('🛒');
  });
});
