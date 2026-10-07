import { logger } from '../utils/logger.js';
import type { KosikProduct, KosikSuggestResponse } from './types.js';

const BASE_URL = 'https://www.kosik.sk/api/front';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function searchProducts(query: string, retries = 2): Promise<KosikProduct[]> {
  // Clean query - remove numbers, units, special chars
  const cleanQuery = query
    .replace(/\d+[xX×]?\s*/g, '')
    .replace(/\b(g|kg|ml|l|ks|balenie|balenia|plechovka|stucik|lzica|lzicka|zvazok)\b/gi, '')
    .replace(/[,./()]/g, '')
    .trim();

  if (!cleanQuery) return [];

  const url = `${BASE_URL}/suggest/v2?query=${encodeURIComponent(cleanQuery)}`;

  logger.debug('Kosik search', { query: cleanQuery });

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await delay(1000 * attempt);

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

      logger.debug('Kosik search results', {
        query: cleanQuery,
        total: products.length,
        available: available.length,
      });

      return available;
    }

    if (response.status === 910 || response.status === 429) {
      logger.warn('Kosik rate limited, retrying', { attempt, query: cleanQuery });
      continue;
    }

    logger.error('Kosik search failed', { status: response.status, query: cleanQuery });
    return [];
  }

  logger.error('Kosik search failed after retries', { query: cleanQuery });
  return [];
}
