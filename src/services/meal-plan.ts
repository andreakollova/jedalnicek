import { parseMealPlanMessage } from '../ai/parser.js';
import * as planDb from '../db/plans.js';
import * as ingredientDb from '../db/ingredients.js';
import { getAllRecipes, findRecipe } from '../recipes/service.js';
import { logger } from '../utils/logger.js';
import type { WeeklyPlan, WeeklyPlanItem } from '../types/index.js';

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export async function processShoppingMessage(
  message: string,
): Promise<{ plan: WeeklyPlan; items: WeeklyPlanItem[]; summary: string }> {
  const today = getTodayDate();
  const recipes = await getAllRecipes();

  logger.info('Parsing shopping message', { date: today });
  const parsed = await parseMealPlanMessage(message, recipes);

  // Create a plan for today (upsert so re-sending replaces)
  const plan = await planDb.createWeeklyPlan({
    week_start: today,
    raw_message: message,
    parsed_plan: parsed,
    status: 'draft',
  });

  // Clear existing items if re-planning
  await planDb.clearPlanItems(plan.id);

  const items: WeeklyPlanItem[] = [];

  for (const r of parsed.recipes) {
    const recipe = await findRecipe(r.name);
    const item = await planDb.addPlanItem({
      plan_id: plan.id,
      type: 'recipe',
      recipe_id: recipe?.id,
      day_start: r.day_start,
      day_end: r.day_end,
      portions: r.portions,
      notes: recipe ? undefined : `Neznamy recept: ${r.name}`,
    });
    items.push({ ...item, recipe: recipe ?? undefined } as WeeklyPlanItem);
  }

  for (const e of parsed.extras) {
    const ingredient = await ingredientDb.findIngredientByName(e.name);
    const item = await planDb.addPlanItem({
      plan_id: plan.id,
      type: 'extra',
      ingredient_id: ingredient?.id,
      day_start: 'monday',
      day_end: 'sunday',
      quantity: e.quantity,
      unit: e.unit,
      notes: ingredient ? undefined : e.name,
    });
    items.push(item);
  }

  await planDb.updateWeeklyPlan(plan.id, { status: 'confirmed' });

  const summary = formatSummary(parsed.recipes, parsed.extras);
  return { plan, items, summary };
}

function formatSummary(
  recipes: { name: string; portions: number }[],
  extras: { name: string; quantity: number; unit: string }[],
): string {
  let text = '';

  if (recipes.length > 0) {
    text += '*Jedla:*\n';
    for (const r of recipes) {
      const portionText = r.portions > 1 ? ` (${r.portions} porcii)` : '';
      text += `  ${r.name}${portionText}\n`;
    }
  }

  if (extras.length > 0) {
    if (text) text += '\n';
    text += '*Extra:*\n';
    for (const e of extras) {
      const qty = e.quantity > 1 ? `${e.quantity}x ` : '';
      const unit = e.unit !== 'ks' ? ` ${e.unit}` : '';
      text += `  ${qty}${e.name}${unit}\n`;
    }
  }

  return text.trim();
}
