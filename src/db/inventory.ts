import { getDb } from './client.js';
import type { InventoryItem } from '../types/index.js';

export async function getInventory(): Promise<InventoryItem[]> {
  const { data, error } = await getDb()
    .from('inventory')
    .select('*, ingredient:ingredients(*)');
  if (error) throw error;
  return data;
}

export async function getInventoryForIngredient(ingredientId: string): Promise<InventoryItem | null> {
  const { data, error } = await getDb()
    .from('inventory')
    .select('*')
    .eq('ingredient_id', ingredientId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function upsertInventoryItem(item: {
  ingredient_id: string;
  status: 'always_buy' | 'have_at_home' | 'buy_if_needed';
  notes?: string;
}): Promise<InventoryItem> {
  const { data, error } = await getDb()
    .from('inventory')
    .upsert({
      ingredient_id: item.ingredient_id,
      status: item.status,
      notes: item.notes ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'ingredient_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}
