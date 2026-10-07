import { getDb } from './client.js';
import type { Ingredient } from '../types/index.js';
import type { IngredientCategory } from '../config/constants.js';

export async function getAllIngredients(): Promise<Ingredient[]> {
  const { data, error } = await getDb()
    .from('ingredients')
    .select('*')
    .order('canonical_name');
  if (error) throw error;
  return data;
}

export async function findIngredientByName(name: string): Promise<Ingredient | null> {
  const lower = name.toLowerCase().trim();
  const { data, error } = await getDb()
    .from('ingredients')
    .select('*');
  if (error) throw error;
  return data.find(i =>
    i.canonical_name.toLowerCase() === lower ||
    i.aliases.some((a: string) => a.toLowerCase() === lower)
  ) ?? null;
}

export async function getIngredientById(id: string): Promise<Ingredient | null> {
  const { data, error } = await getDb()
    .from('ingredients')
    .select('*')
    .eq('id', id)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createIngredient(item: {
  canonical_name: string;
  aliases?: string[];
  default_unit?: string;
  category?: IngredientCategory;
}): Promise<Ingredient> {
  const { data, error } = await getDb()
    .from('ingredients')
    .insert({
      canonical_name: item.canonical_name,
      aliases: item.aliases ?? [],
      default_unit: item.default_unit ?? 'ks',
      category: item.category ?? 'other',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function upsertIngredient(item: {
  canonical_name: string;
  aliases?: string[];
  default_unit?: string;
  category?: IngredientCategory;
}): Promise<Ingredient> {
  const existing = await findIngredientByName(item.canonical_name);
  if (existing) return existing;
  return createIngredient(item);
}
