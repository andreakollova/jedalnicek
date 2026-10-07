import { getDb } from './client.js';
import type { ShoppingRun, ShoppingRunItem, ProductMatch } from '../types/index.js';

// Shopping Runs
export async function getShoppingRun(planId: string, runDate: string): Promise<ShoppingRun | null> {
  const { data, error } = await getDb()
    .from('shopping_runs')
    .select('*')
    .eq('plan_id', planId)
    .eq('run_date', runDate)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createShoppingRun(run: {
  plan_id: string;
  run_day: string;
  run_date: string;
}): Promise<ShoppingRun> {
  const { data, error } = await getDb()
    .from('shopping_runs')
    .upsert({
      plan_id: run.plan_id,
      run_day: run.run_day,
      run_date: run.run_date,
      status: 'pending',
    }, { onConflict: 'plan_id,run_date' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateShoppingRun(id: string, updates: Partial<ShoppingRun>): Promise<ShoppingRun> {
  const { data, error } = await getDb()
    .from('shopping_runs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getRunItems(runId: string): Promise<ShoppingRunItem[]> {
  const { data, error } = await getDb()
    .from('shopping_run_items')
    .select('*, ingredient:ingredients(*)')
    .eq('run_id', runId);
  if (error) throw error;
  return data;
}

export async function addRunItem(item: {
  run_id: string;
  ingredient_id: string;
  required_quantity: number;
  required_unit: string;
}): Promise<ShoppingRunItem> {
  const { data, error } = await getDb()
    .from('shopping_run_items')
    .insert({
      run_id: item.run_id,
      ingredient_id: item.ingredient_id,
      required_quantity: item.required_quantity,
      required_unit: item.required_unit,
      status: 'pending',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Product Matches
export async function getProductMatches(ingredientId: string): Promise<ProductMatch[]> {
  const { data, error } = await getDb()
    .from('product_matches')
    .select('*')
    .eq('ingredient_id', ingredientId)
    .order('preferred', { ascending: false })
    .order('last_seen_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function upsertProductMatch(match: {
  ingredient_id: string;
  kosik_product_id: number;
  product_name: string;
  product_url?: string;
  package_value?: number;
  package_unit?: string;
  last_price?: number;
  last_unit_price?: number;
  unit_price_unit?: string;
  preferred?: boolean;
  match_confidence?: string;
}): Promise<ProductMatch> {
  const { data, error } = await getDb()
    .from('product_matches')
    .upsert({
      ingredient_id: match.ingredient_id,
      kosik_product_id: match.kosik_product_id,
      product_name: match.product_name,
      product_url: match.product_url ?? null,
      package_value: match.package_value ?? null,
      package_unit: match.package_unit ?? null,
      last_price: match.last_price ?? null,
      last_unit_price: match.last_unit_price ?? null,
      unit_price_unit: match.unit_price_unit ?? null,
      preferred: match.preferred ?? false,
      match_confidence: match.match_confidence ?? 'medium',
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'ingredient_id,kosik_product_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}
