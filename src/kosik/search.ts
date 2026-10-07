import { logger } from '../utils/logger.js';
import type { KosikProduct, KosikSuggestResponse } from './types.js';

const BASE_URL = 'https://www.kosik.sk/api/front';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// In-memory cache - products don't change often
const searchCache = new Map<string, { products: KosikProduct[]; ts: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

// Track if Kosik is down
let kosikDown = false;
let kosikDownUntil = 0;

export function isKosikAvailable(): boolean {
  if (kosikDown && Date.now() < kosikDownUntil) return false;
  if (kosikDown && Date.now() >= kosikDownUntil) {
    kosikDown = false;
  }
  return true;
}

export async function searchProducts(query: string): Promise<KosikProduct[]> {
  // Clean query
  const cleanQuery = query
    .replace(/\d+[xX×]?\s*/g, '')
    .replace(/\b(g|kg|ml|l|ks|balenie|balenia|plechovka|stucik|lzica|lzicka|zvazok)\b/gi, '')
    .replace(/[,./()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanQuery || cleanQuery.length < 2) return [];

  // Check cache
  const cached = searchCache.get(cleanQuery);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    logger.debug('Kosik search cache hit', { query: cleanQuery });
    return cached.products;
  }

  // Check if Kosik is down
  if (!isKosikAvailable()) {
    logger.debug('Kosik is down, skipping search', { query: cleanQuery });
    return [];
  }

  const url = `${BASE_URL}/suggest/v2?query=${encodeURIComponent(cleanQuery)}`;
  logger.debug('Kosik search', { query: cleanQuery });

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (response.ok) {
      const data = await response.json() as KosikSuggestResponse;
      const products = data.products?.items ?? [];
      const available = products.filter(p => p.maxInCart > 0);

      // Cache result
      searchCache.set(cleanQuery, { products: available, ts: Date.now() });

      logger.debug('Kosik search results', {
        query: cleanQuery,
        total: products.length,
        available: available.length,
      });

      return available;
    }

    if (response.status === 910 || response.status === 429 || response.status === 503) {
      // Kosik is rate limiting or down - back off for 10 minutes
      kosikDown = true;
      kosikDownUntil = Date.now() + 10 * 60 * 1000;
      logger.warn('Kosik rate limited/down, backing off 10 min', { status: response.status });
      return [];
    }

    logger.error('Kosik search failed', { status: response.status, query: cleanQuery });
    return [];
  } catch (error) {
    logger.error('Kosik search network error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
