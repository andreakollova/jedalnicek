import { z } from 'zod';

export const parsedRecipeItemSchema = z.object({
  name: z.string().min(1),
  portions: z.number().int().positive().default(2),
  day_start: z.enum(['monday', 'wednesday', 'friday']),
  day_end: z.enum(['tuesday', 'thursday', 'sunday']),
  notes: z.string().optional(),
});

export const parsedExtraItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive().default(1),
  unit: z.string().default('ks'),
  notes: z.string().optional(),
});

export const parsedMealPlanSchema = z.object({
  recipes: z.array(parsedRecipeItemSchema),
  extras: z.array(parsedExtraItemSchema),
});

export type ParsedMealPlanOutput = z.infer<typeof parsedMealPlanSchema>;

export const ingredientMatchSchema = z.object({
  ingredient_name: z.string(),
  search_query_sk: z.string(),
  category: z.enum([
    'meat', 'fish', 'vegetables', 'fruit', 'dairy',
    'bakery', 'dry_food', 'drinks', 'frozen', 'household', 'other',
  ]),
  default_unit: z.string(),
});

export const correctionSchema = z.object({
  action: z.enum(['add_recipe', 'remove_recipe', 'change_portions', 'add_extra', 'remove_extra', 'change_day', 'replace_recipe', 'cancel_day']),
  target: z.string().optional(),
  new_value: z.string().optional(),
  portions: z.number().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  day: z.string().optional(),
});

export const correctionsSchema = z.object({
  corrections: z.array(correctionSchema),
  understood: z.boolean(),
  clarification_needed: z.string().optional(),
});
