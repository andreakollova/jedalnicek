import { getDb } from './client.js';
import type { Recipe, RecipeIngredient } from '../types/index.js';

export async function getAllRecipes(): Promise<Recipe[]> {
  const { data, error } = await getDb()
    .from('recipes')
    .select('*')
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return data;
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  const { data, error } = await getDb()
    .from('recipes')
    .select('*')
    .eq('id', id)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function findRecipeByName(name: string): Promise<Recipe | null> {
  const lower = name.toLowerCase().trim();
  const { data, error } = await getDb()
    .from('recipes')
    .select('*')
    .eq('active', true);
  if (error) throw error;
  return data.find(r =>
    r.name.toLowerCase() === lower ||
    r.aliases.some((a: string) => a.toLowerCase() === lower)
  ) ?? null;
}

export async function getRecipeIngredients(recipeId: string): Promise<RecipeIngredient[]> {
  const { data, error } = await getDb()
    .from('recipe_ingredients')
    .select('*, ingredient:ingredients(*)')
    .eq('recipe_id', recipeId);
  if (error) throw error;
  return data;
}

export async function createRecipe(recipe: {
  name: string;
  aliases?: string[];
  default_portions?: number;
  instructions?: string;
}): Promise<Recipe> {
  const { data, error } = await getDb()
    .from('recipes')
    .insert({
      name: recipe.name,
      aliases: recipe.aliases ?? [],
      default_portions: recipe.default_portions ?? 2,
      instructions: recipe.instructions ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addRecipeIngredient(item: {
  recipe_id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  quantity_per_portion?: number;
  optional?: boolean;
  notes?: string;
}): Promise<RecipeIngredient> {
  const { data, error } = await getDb()
    .from('recipe_ingredients')
    .insert({
      recipe_id: item.recipe_id,
      ingredient_id: item.ingredient_id,
      quantity: item.quantity,
      unit: item.unit,
      quantity_per_portion: item.quantity_per_portion ?? null,
      optional: item.optional ?? false,
      notes: item.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
