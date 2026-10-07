import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';

const SESSION_PATH = './kosik-session/state.json';
const KOSIK_URL = 'https://www.kosik.sk';

let _browser: Browser | null = null;
let _context: BrowserContext | null = null;

async function ensureSessionDir() {
  if (!existsSync('./kosik-session')) {
    await mkdir('./kosik-session', { recursive: true });
  }
}

async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.isConnected()) return _browser;
  _browser = await chromium.launch({ headless: true });
  return _browser;
}

async function getContext(): Promise<BrowserContext> {
  if (_context) return _context;

  const browser = await getBrowser();
  await ensureSessionDir();

  if (existsSync(SESSION_PATH)) {
    try {
      _context = await browser.newContext({ storageState: SESSION_PATH });
      logger.info('Kosik session restored from file');
      return _context;
    } catch {
      logger.warn('Failed to restore Kosik session');
    }
  }

  _context = await browser.newContext();
  return _context;
}

async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const context = await getContext();
  const page = await context.newPage();
  try {
    await page.goto(KOSIK_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    return await fn(page);
  } finally {
    await page.close();
  }
}

async function dismissCookiePopup(page: Page) {
  try {
    const btn = page.locator('.popup__wrap-align button').first();
    if (await btn.isVisible({ timeout: 2000 })) {
      await btn.click();
      await page.waitForTimeout(500);
    }
  } catch {}
}

async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    const status = await page.evaluate(async () => {
      const r = await fetch('/api/front/cart', { credentials: 'include' });
      return r.status;
    });
    return status === 200;
  } catch {
    return false;
  }
}

export async function login(): Promise<boolean> {
  const env = getEnv();
  if (!env.KOSIK_EMAIL || !env.KOSIK_PASSWORD) {
    logger.error('Kosik credentials not configured');
    return false;
  }

  // Reset context for fresh login
  _context = null;
  const context = await getContext();
  const page = await context.newPage();

  try {
    await page.goto(KOSIK_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await dismissCookiePopup(page);

    await page.locator('button:has-text("Prihlásiť sa")').first().click({ timeout: 5000 });
    await page.waitForTimeout(3000);

    await page.locator('input[name="Váš e-mail"]').fill(env.KOSIK_EMAIL);
    await page.locator('input[name="Vaše heslo"]').fill(env.KOSIK_PASSWORD);
    await page.locator('button:visible:has-text("Prihlásiť")').first().click();

    await page.waitForURL('**kosik.sk/**', { timeout: 15000 });
    await page.waitForTimeout(3000);

    if (await isLoggedIn(page)) {
      await context.storageState({ path: SESSION_PATH });
      logger.info('Kosik login successful');
      return true;
    }

    logger.error('Kosik login failed');
    return false;
  } catch (error) {
    logger.error('Kosik login error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  } finally {
    await page.close();
  }
}

export async function ensureLoggedIn(): Promise<boolean> {
  return withPage(async (page) => {
    if (await isLoggedIn(page)) return true;
    logger.info('Session expired, re-logging in');
    return login();
  });
}

export async function addToCart(productId: number, quantity: number): Promise<boolean> {
  return withPage(async (page) => {
    const result = await page.evaluate(async ({ productId, quantity }) => {
      const r = await fetch(`/api/front/cart/product/${productId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });
      return { status: r.status, ok: r.ok };
    }, { productId, quantity });

    if (result.ok) {
      logger.info('Added to cart', { productId, quantity });
      const ctx = await getContext();
      await ctx.storageState({ path: SESSION_PATH });
      return true;
    }

    if (result.status === 401) {
      logger.warn('Auth expired while adding to cart');
      return false;
    }

    logger.error('Failed to add to cart', { productId, quantity, status: result.status });
    return false;
  });
}

export async function removeFromCart(productId: number): Promise<boolean> {
  return withPage(async (page) => {
    const result = await page.evaluate(async (productId) => {
      const r = await fetch(`/api/front/cart/product/${productId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 0 }),
      });
      return { status: r.status, ok: r.ok };
    }, productId);

    return result.ok;
  });
}

export interface CartItem {
  productId: number;
  name: string;
  quantity: number;
  price: number;
}

export interface CartState {
  items: CartItem[];
  totalPrice: number;
}

export async function getCart(): Promise<CartState> {
  return withPage(async (page) => {
    const cart = await page.evaluate(async () => {
      const r = await fetch('/api/front/cart', { credentials: 'include' });
      if (!r.ok) return null;
      return r.json();
    });

    if (!cart) return { items: [], totalPrice: 0 };

    const items: CartItem[] = (cart.shoppingCartProducts ?? []).map((p: any) => ({
      productId: p.product?.id,
      name: p.product?.name ?? 'Unknown',
      quantity: p.quantity,
      price: p.product?.price ?? 0,
    }));

    const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    return { items, totalPrice };
  });
}

export async function clearCart(): Promise<boolean> {
  return withPage(async (page) => {
    const result = await page.evaluate(async () => {
      const r = await fetch('/api/front/cart', { credentials: 'include' });
      if (!r.ok) return { ok: false, removed: 0 };
      const cart = await r.json();
      const products = cart.shoppingCartProducts ?? [];
      let removed = 0;
      for (const p of products) {
        const del = await fetch(`/api/front/cart/product/${p.product.id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: 0 }),
        });
        if (del.ok) removed++;
      }
      return { ok: true, removed };
    });

    logger.info('Cart cleared', { removed: result.removed });
    return result.ok;
  });
}

export async function closeBrowser() {
  if (_context) { await _context.close(); _context = null; }
  if (_browser) { await _browser.close(); _browser = null; }
}
