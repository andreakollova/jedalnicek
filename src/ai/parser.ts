import Anthropic from '@anthropic-ai/sdk';
import { getEnv } from '../config/env.js';
import { parsedMealPlanSchema, correctionsSchema, type ParsedMealPlanOutput } from './schemas.js';
import { logger } from '../utils/logger.js';
import type { Recipe } from '../types/index.js';

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (_client) return _client;
  _client = new Anthropic({ apiKey: getEnv().ANTHROPIC_API_KEY });
  return _client;
}

export async function parseMealPlanMessage(
  message: string,
  knownRecipes: Recipe[],
): Promise<ParsedMealPlanOutput> {
  const recipeList = knownRecipes.map(r => {
    const aliases = r.aliases.length > 0 ? ` (aliases: ${r.aliases.join(', ')})` : '';
    return `- ${r.name}${aliases} [default: ${r.default_portions} portions]`;
  }).join('\n');

  const prompt = `Parse this grocery/meal message into JSON. Slovak context.

KNOWN RECIPES:
${recipeList}

RULES:
- If it matches a known recipe, put in "recipes" with the recipe name.
- Everything else is an "extra" (individual grocery item).
- "name" in extras = simple Slovak grocery name for searching on kosik.sk. NO quantities, NO units in the name. Just the product name.
- Quantities go in "quantity" field, units in "unit" field.
- Valid units: ks, kg, g, l, ml, balenie
- If user says "500g cibula", name="cibula", quantity=500, unit="g"
- If user says "2x mineralna voda", name="mineralna voda", quantity=2, unit="ks"
- If user says "vajcia", name="vajcia", quantity=1, unit="balenie"
- If user says "jablka 800g", name="jablka", quantity=800, unit="g"
- day_start/day_end: distribute recipes across monday-tuesday, wednesday-thursday, friday-sunday.

USER MESSAGE:
${message}

JSON only, no markdown:
{
  "recipes": [{ "name": "string", "portions": 2, "day_start": "monday", "day_end": "tuesday" }],
  "extras": [{ "name": "string", "quantity": 1, "unit": "ks" }]
}`;

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    logger.error('AI returned no JSON', { text });
    throw new Error('AI parser returned no valid JSON');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const validated = parsedMealPlanSchema.safeParse(parsed);

  if (!validated.success) {
    logger.error('AI output failed validation', {
      errors: validated.error.issues,
      raw: parsed,
    });
    throw new Error(`AI output validation failed: ${validated.error.message}`);
  }

  return validated.data;
}

export async function parseCorrectionMessage(
  message: string,
  currentPlanSummary: string,
  knownRecipes: Recipe[],
): Promise<ReturnType<typeof correctionsSchema.parse>> {
  const recipeList = knownRecipes.map(r => `- ${r.name}`).join('\n');

  const prompt = `You are a meal planning assistant. The user wants to modify their existing weekly meal plan.

CURRENT PLAN:
${currentPlanSummary}

KNOWN RECIPES:
${recipeList}

USER MESSAGE:
${message}

Parse the user's correction into structured actions. Respond with ONLY valid JSON:
{
  "corrections": [
    {
      "action": "add_recipe"|"remove_recipe"|"change_portions"|"add_extra"|"remove_extra"|"change_day"|"replace_recipe"|"cancel_day",
      "target": "recipe or item name being modified",
      "new_value": "new recipe name if replacing",
      "portions": number,
      "quantity": number,
      "unit": "string",
      "day": "monday"|"wednesday"|"friday"
    }
  ],
  "understood": true|false,
  "clarification_needed": "optional question if something is unclear"
}`;

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI correction parser returned no valid JSON');

  const parsed = JSON.parse(jsonMatch[0]);
  const validated = correctionsSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Correction validation failed: ${validated.error.message}`);
  }

  return validated.data;
}
