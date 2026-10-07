import { getScaledIngredients } from '../recipes/service.js';
import { mergeIngredients } from './merger.js';
import { getInventoryForIngredient } from '../db/inventory.js';
import type { WeeklyPlanItem, ShoppingListEntry } from '../types/index.js';

export async function buildShoppingList(items: WeeklyPlanItem[]): Promise<ShoppingListEntry[]> {
  const entries: ShoppingListEntry[] = [];

  // Expand recipe items into ingredients
  for (const item of items) {
    if (item.type === 'recipe' && item.recipe_id) {
      const scaled = await getScaledIngredients(item.recipe_id, item.portions);
      for (const s of scaled) {
        if (s.optional) continue;
        entries.push({
          ingredient_id: s.ingredient_id,
          ingredient_name: s.ingredient_name,
          total_quantity: s.quantity,
          unit: s.unit,
          source_recipes: [item.recipe?.name ?? 'Unknown'],
          is_extra: false,
        });
      }
    } else if (item.type === 'extra') {
      entries.push({
        ingredient_id: item.ingredient_id ?? '',
        ingredient_name: item.ingredient?.canonical_name ?? item.notes ?? 'Unknown',
        total_quantity: item.quantity ?? 1,
        unit: item.unit ?? 'ks',
        source_recipes: [],
        is_extra: true,
      });
    }
  }

  // Merge duplicate ingredients
  const merged = mergeIngredients(entries);

  // Apply inventory rules
  const filtered: ShoppingListEntry[] = [];
  for (const entry of merged) {
    if (!entry.ingredient_id) {
      filtered.push(entry);
      continue;
    }
    const inv = await getInventoryForIngredient(entry.ingredient_id);
    if (inv?.status === 'have_at_home') continue;
    filtered.push(entry);
  }

  return filtered;
}
