import { normalizeUnit } from './units.js';
import type { ShoppingListEntry } from '../types/index.js';

export function mergeIngredients(entries: ShoppingListEntry[]): ShoppingListEntry[] {
  const merged = new Map<string, ShoppingListEntry>();

  for (const entry of entries) {
    const key = entry.ingredient_id;
    const existing = merged.get(key);

    if (existing) {
      // Normalize both to same unit before adding
      const norm1 = normalizeUnit(existing.total_quantity, existing.unit);
      const norm2 = normalizeUnit(entry.total_quantity, entry.unit);

      if (norm1.unit === norm2.unit) {
        existing.total_quantity = norm1.quantity + norm2.quantity;
        existing.unit = norm1.unit;
      } else {
        // Different unit types, keep the larger quantity's unit
        existing.total_quantity += entry.total_quantity;
      }

      existing.source_recipes = [...new Set([...existing.source_recipes, ...entry.source_recipes])];
    } else {
      const norm = normalizeUnit(entry.total_quantity, entry.unit);
      merged.set(key, { ...entry, total_quantity: norm.quantity, unit: norm.unit });
    }
  }

  return Array.from(merged.values());
}
