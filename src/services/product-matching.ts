import { searchProducts, isKosikAvailable } from '../kosik/search.js';
import { getProductMatches, upsertProductMatch } from '../db/shopping.js';
import { logger } from '../utils/logger.js';
import type { KosikProduct } from '../kosik/types.js';
import type { ShoppingListEntry } from '../types/index.js';

export interface MatchedProduct {
  ingredient_id: string;
  ingredient_name: string;
  required_quantity: number;
  required_unit: string;
  product: KosikProduct | null;
  packages_needed: number;
  confidence: 'high' | 'medium' | 'low';
  is_substitution: boolean;
  original_product_name?: string;
}

export async function matchProductsForList(
  shoppingList: ShoppingListEntry[],
): Promise<MatchedProduct[]> {
  const results: MatchedProduct[] = [];

  for (let i = 0; i < shoppingList.length; i++) {
    // 20s between searches - ultra safe
    if (i > 0) await new Promise(r => setTimeout(r, 20000));

    // If Kosik went down during this run, skip remaining
    if (!isKosikAvailable()) {
      logger.warn('Kosik went down, skipping remaining items');
      for (let j = i; j < shoppingList.length; j++) {
        results.push({
          ingredient_id: shoppingList[j].ingredient_id,
          ingredient_name: shoppingList[j].ingredient_name,
          required_quantity: shoppingList[j].total_quantity,
          required_unit: shoppingList[j].unit,
          product: null,
          packages_needed: 0,
          confidence: 'low',
          is_substitution: false,
        });
      }
      break;
    }

    const match = await matchSingleIngredient(shoppingList[i]);
    results.push(match);
  }

  return results;
}

async function matchSingleIngredient(entry: ShoppingListEntry): Promise<MatchedProduct> {
  const base: Omit<MatchedProduct, 'product' | 'packages_needed' | 'confidence' | 'is_substitution'> = {
    ingredient_id: entry.ingredient_id,
    ingredient_name: entry.ingredient_name,
    required_quantity: entry.total_quantity,
    required_unit: entry.unit,
  };

  // 1. Check for existing preferred/known product match
  if (entry.ingredient_id) {
    const existingMatches = await getProductMatches(entry.ingredient_id);
    const preferred = existingMatches.find(m => m.preferred);

    if (preferred) {
      // Verify it's still available by searching
      const products = await searchProducts(preferred.product_name.split(' ').slice(0, 3).join(' '));
      const stillAvailable = products.find(p => p.id === preferred.kosik_product_id);

      if (stillAvailable) {
        const packagesNeeded = calculatePackages(
          entry.total_quantity, entry.unit,
          stillAvailable.productQuantity.value, stillAvailable.productQuantity.unit,
        );

        // Update last seen
        await upsertProductMatch({
          ingredient_id: entry.ingredient_id,
          kosik_product_id: stillAvailable.id,
          product_name: stillAvailable.name,
          product_url: stillAvailable.url,
          package_value: stillAvailable.productQuantity.value,
          package_unit: stillAvailable.productQuantity.unit,
          last_price: stillAvailable.price,
          last_unit_price: stillAvailable.pricePerUnit.price,
          unit_price_unit: stillAvailable.pricePerUnit.unit,
          preferred: true,
          match_confidence: 'high',
        });

        return {
          ...base,
          product: stillAvailable,
          packages_needed: packagesNeeded,
          confidence: 'high',
          is_substitution: false,
        };
      }
    }
  }

  // 2. Search Kosik for this ingredient
  const searchQuery = entry.ingredient_name;
  const products = await searchProducts(searchQuery);

  if (products.length === 0) {
    logger.warn('No products found', { ingredient: searchQuery });
    return { ...base, product: null, packages_needed: 0, confidence: 'low', is_substitution: false };
  }

  // 3. Pick the best product (cheapest per unit, available)
  const scored = products.map(p => ({
    product: p,
    score: scoreProduct(p, entry),
  })).sort((a, b) => b.score - a.score);

  const best = scored[0];
  const confidence = best.score >= 0.7 ? 'high' : best.score >= 0.4 ? 'medium' : 'low';

  const packagesNeeded = calculatePackages(
    entry.total_quantity, entry.unit,
    best.product.productQuantity.value, best.product.productQuantity.unit,
  );

  // Save the match for future use
  if (entry.ingredient_id) {
    await upsertProductMatch({
      ingredient_id: entry.ingredient_id,
      kosik_product_id: best.product.id,
      product_name: best.product.name,
      product_url: best.product.url,
      package_value: best.product.productQuantity.value,
      package_unit: best.product.productQuantity.unit,
      last_price: best.product.price,
      last_unit_price: best.product.pricePerUnit.price,
      unit_price_unit: best.product.pricePerUnit.unit,
      preferred: confidence === 'high',
      match_confidence: confidence,
    });
  }

  return {
    ...base,
    product: best.product,
    packages_needed: packagesNeeded,
    confidence,
    is_substitution: false,
  };
}

function scoreProduct(product: KosikProduct, entry: ShoppingListEntry): number {
  let score = 0.5; // base score for being found

  // Name similarity boost
  const nameLower = product.cleanName?.toLowerCase() ?? product.name.toLowerCase();
  const searchLower = entry.ingredient_name.toLowerCase();
  if (nameLower.includes(searchLower) || searchLower.includes(nameLower)) {
    score += 0.3;
  }

  // Availability boost
  if (product.availability.length > 0 && product.availability[0].quantity > 0) {
    score += 0.1;
  }

  // Sale bonus
  if (product.isSale) {
    score += 0.05;
  }

  // Penalize very expensive items
  if (product.price > 20) {
    score -= 0.1;
  }

  return Math.min(1, Math.max(0, score));
}

function calculatePackages(
  requiredQty: number, requiredUnit: string,
  packageQty: number, packageUnit: string,
): number {
  // Normalize units
  const reqNorm = normalizeToGrams(requiredQty, requiredUnit);
  const pkgNorm = normalizeToGrams(packageQty, packageUnit);

  if (reqNorm.unit !== pkgNorm.unit) {
    // Can't compare, assume 1 package
    return 1;
  }

  return Math.ceil(reqNorm.value / pkgNorm.value);
}

function normalizeToGrams(value: number, unit: string): { value: number; unit: string } {
  switch (unit.toLowerCase()) {
    case 'kg': return { value: value * 1000, unit: 'g' };
    case 'g': return { value, unit: 'g' };
    case 'l': return { value: value * 1000, unit: 'ml' };
    case 'ml': return { value, unit: 'ml' };
    case 'dl': return { value: value * 100, unit: 'ml' };
    default: return { value, unit: unit.toLowerCase() };
  }
}
