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

  // 1. Check for existing preferred product match
  if (entry.ingredient_id) {
    const existingMatches = await getProductMatches(entry.ingredient_id);
    const preferred = existingMatches.find(m => m.preferred);

    if (preferred) {
      const products = await searchProducts(preferred.product_name.split(' ').slice(0, 3).join(' '));
      const stillAvailable = products.find(p => p.id === preferred.kosik_product_id);

      if (stillAvailable) {
        const packagesNeeded = calculatePackages(
          entry.total_quantity, entry.unit,
          stillAvailable.productQuantity.value, stillAvailable.productQuantity.unit,
        );

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

  // 2. Search Kosik
  const products = await searchProducts(entry.ingredient_name);

  if (products.length === 0) {
    logger.warn('No products found', { ingredient: entry.ingredient_name });
    return { ...base, product: null, packages_needed: 0, confidence: 'low', is_substitution: false };
  }

  // 3. Score and pick the best product
  const reqNorm = normalizeToGrams(entry.total_quantity, entry.unit);

  const scored = products.map(p => {
    const pkgNorm = normalizeToGrams(p.productQuantity.value, p.productQuantity.unit);
    const packagesNeeded = (reqNorm.unit === pkgNorm.unit && pkgNorm.value > 0)
      ? Math.ceil(reqNorm.value / pkgNorm.value)
      : 1;
    const totalCost = p.price * packagesNeeded;
    const totalAmount = pkgNorm.value * packagesNeeded;
    const waste = (reqNorm.unit === pkgNorm.unit && reqNorm.value > 0)
      ? (totalAmount - reqNorm.value) / reqNorm.value
      : 0;

    return {
      product: p,
      packagesNeeded,
      totalCost,
      waste,
      score: scoreProduct(p, entry, totalCost, waste),
    };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  const confidence = best.score >= 0.6 ? 'high' : best.score >= 0.3 ? 'medium' : 'low';

  logger.debug('Product match', {
    ingredient: entry.ingredient_name,
    chosen: best.product.name,
    price: best.totalCost.toFixed(2),
    packages: best.packagesNeeded,
    waste: (best.waste * 100).toFixed(0) + '%',
    score: best.score.toFixed(2),
  });

  // Save match
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
    packages_needed: best.packagesNeeded,
    confidence,
    is_substitution: false,
  };
}

function scoreProduct(
  product: KosikProduct,
  entry: ShoppingListEntry,
  totalCost: number,
  waste: number,
): number {
  let score = 0;

  // --- NAME RELEVANCE (0 to 0.4) ---
  const nameLower = (product.cleanName ?? product.name).toLowerCase();
  const searchWords = entry.ingredient_name.toLowerCase().split(/\s+/);
  const matchedWords = searchWords.filter(w => nameLower.includes(w));
  score += (matchedWords.length / searchWords.length) * 0.4;

  // --- CHEAPEST TOTAL COST (0 to 0.3) ---
  // Lower total cost = higher score
  if (totalCost <= 2) score += 0.3;
  else if (totalCost <= 5) score += 0.25;
  else if (totalCost <= 10) score += 0.15;
  else if (totalCost <= 15) score += 0.05;
  // > 15 EUR = no bonus

  // --- PACKAGE SIZE FIT (0 to 0.2) ---
  // Prefer packages that minimize waste (closest to needed quantity)
  if (waste <= 0.1) score += 0.2;       // less than 10% waste - perfect
  else if (waste <= 0.3) score += 0.15;  // 10-30% waste - good
  else if (waste <= 0.5) score += 0.1;   // 30-50% waste - ok
  else if (waste <= 1.0) score += 0.05;  // 50-100% waste - not great
  // > 100% waste (buying 2x+ what needed) = no bonus

  // --- AVAILABILITY (0 to 0.05) ---
  if (product.availability.length > 0 && product.availability[0].quantity > 0) {
    score += 0.05;
  }

  // --- SALE BONUS (0 to 0.05) ---
  if (product.isSale || product.percentageDiscount > 0) {
    score += 0.05;
  }

  // --- PENALIZE BIO when not asked for (-0.1) ---
  const nameUpper = product.name.toUpperCase();
  const askedBio = entry.ingredient_name.toLowerCase().includes('bio');
  if (!askedBio && (nameUpper.startsWith('BIO ') || nameUpper.includes(' BIO '))) {
    score -= 0.1;
  }

  // --- PENALIZE very expensive single items ---
  if (product.price > 10) score -= 0.05;
  if (product.price > 20) score -= 0.1;

  return Math.max(0, score);
}

function calculatePackages(
  requiredQty: number, requiredUnit: string,
  packageQty: number, packageUnit: string,
): number {
  const reqNorm = normalizeToGrams(requiredQty, requiredUnit);
  const pkgNorm = normalizeToGrams(packageQty, packageUnit);

  if (reqNorm.unit !== pkgNorm.unit) return 1;
  if (pkgNorm.value <= 0) return 1;

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
