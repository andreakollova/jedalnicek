import { App, LogLevel } from '@slack/bolt';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { processShoppingMessage } from '../services/meal-plan.js';
import { executeShoppingRun } from '../services/shopping-run.js';
import { clearCart, ensureLoggedIn, closeBrowser } from '../kosik/adapter.js';
import { planConfirmation, shoppingPrompt } from './messages.js';

let _app: App | null = null;

export function getSlackApp(): App {
  if (_app) return _app;
  const env = getEnv();
  _app = new App({
    token: env.SLACK_BOT_TOKEN,
    signingSecret: env.SLACK_SIGNING_SECRET,
    appToken: env.SLACK_APP_TOKEN,
    socketMode: true,
    logLevel: env.LOG_LEVEL === 'debug' ? LogLevel.DEBUG : LogLevel.INFO,
  });
  registerHandlers(_app);
  return _app;
}

function registerHandlers(app: App) {
  app.message(async ({ message, say }) => {
    if (message.subtype || !('text' in message) || !message.text) return;

    const env = getEnv();

    // Only respond in the designated channel
    if ('channel' in message && message.channel !== env.SLACK_CHANNEL_ID) return;

    // Ignore bot's own messages
    if ('bot_id' in message) return;

    // Security: only respond to allowed users
    const allowedUsers = env.SLACK_ALLOWED_USER_IDS.split(',');
    if (!allowedUsers.includes(message.user!)) {
      logger.warn('Message from unauthorized user', { user: message.user });
      return;
    }

    const text = message.text.trim();
    if (!text) return;

    logger.info('Received message', { user: message.user, textLength: text.length });

    try {
      // Check for clear cart command
      if (/vymaz|vymazat|clear|vyprazdni|vycisti|prec/i.test(text) && /kosik|cart|polozky/i.test(text)) {
        await say('Mazem kosik...');
        const loggedIn = await ensureLoggedIn();
        if (loggedIn) {
          await clearCart();
          await closeBrowser();
          await say('Kosik je prazdny.');
        } else {
          await say('Nepodarilo sa prihlasit do Kosiku.');
        }
        return;
      }

      const waitMsgs = [
        'Jasne, uz na tom pracujem! O chvilu ti poslem finalny kosik. Pockaj prosim par minut.',
        'Ok, idem na to! Za par minut bude kosik pripraveny.',
        'Super, spracuvavam zoznam. Pockaj chvilku, dam ti vediet ked bude hotovo.',
        'Mam to, hladam produkty a plnim kosik. Ozvi sa za par minut.',
      ];
      await say(waitMsgs[Math.floor(Math.random() * waitMsgs.length)]);

      const result = await processShoppingMessage(text);
      await executeShoppingRun(result.plan);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Error processing message', { error: msg });

      if (msg.includes('credit balance is too low')) {
        await say('Dosli Anthropic kredity. Treba dokupic na console.anthropic.com/settings/billing');
      } else {
        await say(`Nastala chyba: ${msg}`);
      }
    }
  });
}

export async function sendShoppingPrompt(day: 'monday' | 'wednesday' | 'friday'): Promise<void> {
  const env = getEnv();
  const app = getSlackApp();

  const config = {
    monday: { label: 'Pondelok', days: 'dnes a zajtra' },
    wednesday: { label: 'Streda', days: 'dnes a zajtra' },
    friday: { label: 'Piatok', days: 'do nedele' },
  };

  const { label, days } = config[day];

  await app.client.chat.postMessage({
    channel: env.SLACK_CHANNEL_ID,
    text: shoppingPrompt(label, days),
  });
  logger.info(`Shopping prompt sent for ${day}`);
}

export async function sendSlackMessage(text: string): Promise<void> {
  const env = getEnv();
  const app = getSlackApp();

  await app.client.chat.postMessage({
    channel: env.SLACK_CHANNEL_ID,
    text,
  });
}
