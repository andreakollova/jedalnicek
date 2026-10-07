import type { RecipeIngredient } from '../types/index.js';

export interface ScaledIngredient {
  ingredient_id: string;
  ingredient_name: string;
  quantity: number;
  unit: string;
  optional: boolean;
  notes: string | null;
}

export function scaleRecipeIngredients(
  ingredients: RecipeIngredient[],
  defaultPortions: number,
  requestedPortions: number,
): ScaledIngredient[] {
  const ratio = requestedPortions / defaultPortions;

  return ingredients.map(ri => {
    let scaledQuantity: number;

    if (ri.quantity_per_portion !== null) {
      scaledQuantity = ri.quantity_per_portion * requestedPortions;
    } else {
      scaledQuantity = ri.quantity * ratio;
    }

    // Round to reasonable precision
    scaledQuantity = roundQuantity(scaledQuantity, ri.unit);

    return {
      ingredient_id: ri.ingredient_id,
      ingredient_name: ri.ingredient?.canonical_name ?? ri.ingredient_id,
      quantity: scaledQuantity,
      unit: ri.unit,
      optional: ri.optional,
      notes: ri.notes,
    };
  });
}

function roundQuantity(value: number, unit: string): number {
  // Whole units (ks, pieces, cans, etc.)
  if (['ks', 'balenie', 'plechovka', 'can', 'piece'].includes(unit)) {
    return Math.ceil(value);
  }
  // Weight/volume - round to 1 decimal
  if (['g', 'kg', 'ml', 'l'].includes(unit)) {
    return Math.round(value * 10) / 10;
  }
  // Tablespoons, teaspoons - round to 0.5
  if (['lzica', 'lzicka', 'tbsp', 'tsp'].includes(unit)) {
    return Math.round(value * 2) / 2;
  }
  return Math.round(value * 100) / 100;
}
