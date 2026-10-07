import { getPlanItems } from '../db/plans.js';
import { buildShoppingList } from '../shopping/planner.js';
import { matchProductsForList } from './product-matching.js';
import { isKosikAvailable } from '../kosik/search.js';
import { ensureLoggedIn, addToCart, closeBrowser } from '../kosik/adapter.js';
import { sendSlackMessage } from '../slack/app.js';
import { logger } from '../utils/logger.js';
import type { WeeklyPlan } from '../types/index.js';

const KOSIK_CART_URL = 'https://www.kosik.sk/basket';

export async function executeShoppingRun(plan: WeeklyPlan): Promise<void> {
  logger.info('Starting shopping run', { planId: plan.id });

  const items = await getPlanItems(plan.id);
  if (items.length === 0) {
    await sendSlackMessage('Ziadne polozky v plane.');
    return;
  }

  const shoppingList = await buildShoppingList(items);
  logger.info('Shopping list built', { items: shoppingList.length });

  const matches = await matchProductsForList(shoppingList);

  const found = matches.filter(m => m.product && m.confidence !== 'low');
  const skipped = matches.filter(m => !m.product || m.confidence === 'low');

  // If Kosik went down and nothing was found, tell the user
  if (found.length === 0 && !isKosikAvailable()) {
    await sendSlackMessage(
      'Kosik.sk momentalne nefunguje (rate limit alebo vypadok). ' +
      'Skus to prosim neskor, alebo otvor kosik.sk rucne.\n\n' +
      'Tvoj zoznam som si ulozil, staci napisat "skus znova" a pokusim sa znova.'
    );
    return;
  }

  // Try to add to Kosik cart
  let kosikConnected = false;
  let cartAdded = 0;
  let cartFailed = 0;

  if (found.length > 0) {
    const loggedIn = await ensureLoggedIn();

    if (loggedIn) {
      kosikConnected = true;
      logger.info('Kosik logged in, adding products to cart');

      for (const m of found) {
        if (!m.product) continue;
        const qty = Math.max(1, m.packages_needed);
        const success = await addToCart(m.product.id, qty);
        if (success) {
          cartAdded++;
        } else {
          cartFailed++;
          logger.warn('Failed to add product', { productId: m.product.id, name: m.product.name });
        }
        // 10s between cart adds
        await new Promise(r => setTimeout(r, 10000));
      }

      await closeBrowser();
    } else {
      logger.warn('Kosik login failed, sending list only');
    }
  }

  // Build Slack summary
  const estimatedTotal = found.reduce((sum, m) => {
    return sum + (m.product ? m.product.price * m.packages_needed : 0);
  }, 0);

  let text = '';

  if (kosikConnected && cartAdded > 0) {
    text += `Hotovo! V kosiku je ${cartAdded} produktov.\n\n`;
  } else if (found.length > 0 && !kosikConnected) {
    text += `Nasiel som produkty ale nepodarilo sa prihlasit do Kosiku.\n\n`;
  }

  if (found.length > 0) {
    text += `*Produkty:*\n`;
    for (const m of found) {
      if (!m.product) continue;
      const pkg = m.product.productQuantity;
      const pkgLabel = pkg ? `${pkg.value} ${pkg.unit}` : '';
      const qty = m.packages_needed > 1 ? `${m.packages_needed}x ` : '';
      const linePrice = (m.product.price * m.packages_needed).toFixed(2);
      text += `  ${qty}${m.product.name}`;
      if (pkgLabel) text += ` (${pkgLabel})`;
      text += ` - ${linePrice} EUR\n`;
    }
  }

  if (skipped.length > 0) {
    text += `\n*Nenasiel som (${skipped.length}):*\n`;
    for (const s of skipped) {
      text += `  ${s.ingredient_name}\n`;
    }
  }

  if (cartFailed > 0) {
    text += `\n*Nepodarilo sa pridat: ${cartFailed}*\n`;
  }

  if (found.length > 0) {
    text += `\n*Spolu: ${estimatedTotal.toFixed(2)} EUR*`;
    text += `\n${KOSIK_CART_URL}`;
  }

  await sendSlackMessage(text);
  logger.info('Shopping run complete', { added: cartAdded, failed: cartFailed, skipped: skipped.length });
}
