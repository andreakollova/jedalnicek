export const TIMEZONE = 'Europe/Bratislava';

export const SHOPPING_DAYS = {
  monday: { covers: ['monday', 'tuesday'], label: 'Pondelok' },
  wednesday: { covers: ['wednesday', 'thursday'], label: 'Streda' },
  friday: { covers: ['friday', 'saturday', 'sunday'], label: 'Piatok' },
} as const;

export type ShoppingDay = keyof typeof SHOPPING_DAYS;

export const DAY_NAMES_SK: Record<string, string> = {
  monday: 'Pondelok',
  tuesday: 'Utorok',
  wednesday: 'Streda',
  thursday: 'Štvrtok',
  friday: 'Piatok',
  saturday: 'Sobota',
  sunday: 'Nedeľa',
};

export const INGREDIENT_CATEGORIES = [
  'meat',
  'fish',
  'vegetables',
  'fruit',
  'dairy',
  'bakery',
  'dry_food',
  'drinks',
  'frozen',
  'household',
  'other',
] as const;

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const PLAN_STATUSES = ['draft', 'confirmed', 'active', 'completed'] as const;
export const RUN_STATUSES = ['pending', 'processing', 'cart_prepared', 'partial', 'failed', 'cancelled'] as const;
export const INVENTORY_STATUSES = ['always_buy', 'have_at_home', 'buy_if_needed'] as const;
