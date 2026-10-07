import type { IngredientCategory, ConfidenceLevel } from '../config/constants.js';

export interface Ingredient {
  id: string;
  canonical_name: string;
  aliases: string[];
  default_unit: string;
  category: IngredientCategory;
  created_at: string;
  updated_at: string;
}

export interface Recipe {
  id: string;
  name: string;
  aliases: string[];
  default_portions: number;
  instructions: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  quantity_per_portion: number | null;
  optional: boolean;
  notes: string | null;
  created_at: string;
  ingredient?: Ingredient;
}

export interface WeeklyPlan {
  id: string;
  week_start: string;
  status: string;
  raw_message: string | null;
  parsed_plan: unknown;
  created_at: string;
  updated_at: string;
}

export interface WeeklyPlanItem {
  id: string;
  plan_id: string;
  type: 'recipe' | 'extra';
  recipe_id: string | null;
  ingredient_id: string | null;
  day_start: string;
  day_end: string;
  portions: number;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  created_at: string;
  recipe?: Recipe;
  ingredient?: Ingredient;
}

export interface InventoryItem {
  id: string;
  ingredient_id: string;
  status: 'always_buy' | 'have_at_home' | 'buy_if_needed';
  notes: string | null;
  created_at: string;
  updated_at: string;
  ingredient?: Ingredient;
}

export interface ProductMatch {
  id: string;
  ingredient_id: string;
  kosik_product_id: number;
  product_name: string;
  product_url: string | null;
  package_value: number | null;
  package_unit: string | null;
  last_price: number | null;
  last_unit_price: number | null;
  unit_price_unit: string | null;
  preferred: boolean;
  match_confidence: ConfidenceLevel;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface ShoppingRun {
  id: string;
  plan_id: string;
  run_day: string;
  run_date: string;
  status: string;
  items_total: number;
  items_added: number;
  items_skipped: number;
  items_substituted: number;
  estimated_total: number | null;
  cart_snapshot: unknown;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ShoppingRunItem {
  id: string;
  run_id: string;
  ingredient_id: string;
  required_quantity: number;
  required_unit: string;
  product_match_id: string | null;
  kosik_product_id: number | null;
  product_name: string | null;
  package_quantity: number;
  status: string;
  substitution_reason: string | null;
  original_product_name: string | null;
  price: number | null;
  created_at: string;
  ingredient?: Ingredient;
}

export interface AutomationLog {
  id: string;
  job: string;
  run_id: string | null;
  status: string;
  error: string | null;
  metadata: unknown;
  started_at: string;
  completed_at: string | null;
}

// AI parser output types
export interface ParsedMealPlan {
  recipes: ParsedRecipeItem[];
  extras: ParsedExtraItem[];
}

export interface ParsedRecipeItem {
  name: string;
  portions: number;
  day_start: string;
  day_end: string;
  notes?: string;
}

export interface ParsedExtraItem {
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
}

// Shopping list types
export interface ShoppingListEntry {
  ingredient_id: string;
  ingredient_name: string;
  total_quantity: number;
  unit: string;
  source_recipes: string[];
  is_extra: boolean;
}
