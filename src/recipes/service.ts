import * as recipeDb from '../db/recipes.js';
import * as ingredientDb from '../db/ingredients.js';
import { scaleRecipeIngredients, type ScaledIngredient } from './scaling.js';
import type { Recipe, RecipeIngredient } from '../types/index.js';

export async function getAllRecipes(): Promise<Recipe[]> {
  return recipeDb.getAllRecipes();
}

export async function findRecipe(name: string): Promise<Recipe | null> {
  return recipeDb.findRecipeByName(name);
}

export async function getScaledIngredients(
  recipeId: string,
  portions: number,
): Promise<ScaledIngredient[]> {
  const recipe = await recipeDb.getRecipeById(recipeId);
  if (!recipe) throw new Error(`Recipe not found: ${recipeId}`);

  const ingredients = await recipeDb.getRecipeIngredients(recipeId);
  return scaleRecipeIngredients(ingredients, recipe.default_portions, portions);
}

export async function createFullRecipe(params: {
  name: string;
  aliases?: string[];
  default_portions?: number;
  instructions?: string;
  ingredients: {
    canonical_name: string;
    quantity: number;
    unit: string;
    quantity_per_portion?: number;
    optional?: boolean;
    notes?: string;
    category?: 'meat' | 'fish' | 'vegetables' | 'fruit' | 'dairy' | 'bakery' | 'dry_food' | 'drinks' | 'frozen' | 'household' | 'other';
    aliases?: string[];
  }[];
}): Promise<Recipe> {
  const recipe = await recipeDb.createRecipe({
    name: params.name,
    aliases: params.aliases,
    default_portions: params.default_portions,
    instructions: params.instructions,
  });

  for (const ing of params.ingredients) {
    const ingredient = await ingredientDb.upsertIngredient({
      canonical_name: ing.canonical_name,
      default_unit: ing.unit,
      category: ing.category,
      aliases: ing.aliases,
    });

    await recipeDb.addRecipeIngredient({
      recipe_id: recipe.id,
      ingredient_id: ingredient.id,
      quantity: ing.quantity,
      unit: ing.unit,
      quantity_per_portion: ing.quantity_per_portion,
      optional: ing.optional,
      notes: ing.notes,
    });
  }

  return recipe;
}
