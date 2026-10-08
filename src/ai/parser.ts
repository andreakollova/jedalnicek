import Anthropic from '@anthropic-ai/sdk';
import { getEnv } from '../config/env.js';
import { parsedMealPlanSchema, type ParsedMealPlanOutput } from './schemas.js';
import { logger } from '../utils/logger.js';
import type { Recipe } from '../types/index.js';

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (_client) return _client;
  _client = new Anthropic({ apiKey: getEnv().ANTHROPIC_API_KEY });
  return _client;
}

// Strip markdown, prices, bullets, formatting from user message
function cleanMessage(msg: string): string {
  return msg
    .replace(/\*\*[^*]*\*\*/g, '')       // remove **bold text** (prices like **1,20 €**)
    .replace(/\*([^*]+)\*/g, '$1')        // *italic* -> just text
    .replace(/^[\s]*[*\-•]\s*/gm, '')     // remove bullet points
    .replace(/–\s*$/gm, '')               // remove trailing dashes
    .replace(/\d+[,.]?\d*\s*€/g, '')      // remove prices like 1,20 €
    .replace(/\(\s*\)/g, '')              // remove empty parens
    .replace(/\n{3,}/g, '\n\n')           // collapse multiple newlines
    .trim();
}

export async function parseMealPlanMessage(
  message: string,
  knownRecipes: Recipe[],
): Promise<ParsedMealPlanOutput> {
  const recipeList = knownRecipes.map(r => {
    const aliases = r.aliases.length > 0 ? ` (aliases: ${r.aliases.join(', ')})` : '';
    return `- ${r.name}${aliases} [default: ${r.default_portions} portions]`;
  }).join('\n');

  const cleaned = cleanMessage(message);
  logger.info('Cleaned message for AI', { original: message.length, cleaned: cleaned.length });

  const prompt = `You are a grocery list parser. Parse EVERY item in the list below into JSON.

KNOWN RECIPES:
${recipeList}

RULES:
- EVERY line/item must appear in the output. Do NOT skip any items.
- If it matches a known recipe, put in "recipes".
- Everything else goes into "extras" as individual grocery items.
- "name" = simple Slovak product name for searching kosik.sk. NO quantities, NO units, NO prices in name.
- Quantities go in "quantity" field, units in "unit" field.
- Valid units: ks, kg, g, l, ml, balenie
- Examples:
  "Ryžové krekry (2 balenia)" -> name="ryzove krekry", quantity=2, unit="balenie"
  "Ryža dlhozrnná (1 kg)" -> name="ryza dlhozrnna", quantity=1, unit="kg"
  "Červená šošovica (500 g)" -> name="cervena sosovica", quantity=500, unit="g"
  "Vajcia čerstvé M/L (15 ks)" -> name="vajcia M/L", quantity=15, unit="ks"
  "Mlieko plnotučné, 1ks" -> name="mlieko plnotucne", quantity=1, unit="ks"
  "Celé kura (cca 1,8 kg)" -> name="cele kura", quantity=1, unit="ks"
  "Mleté morčacie mäso (1 kg)" -> name="mlete morcacie maso", quantity=1, unit="kg"
  "Slnečnicové semienka (100 g) + Vlašské orechy (100 g)" -> TWO items: semienka AND orechy
- If one line contains multiple items separated by "+" or ",", split them into separate extras.
- Ignore prices, euro signs, dashes.
- day_start/day_end for recipes: monday-tuesday, wednesday-thursday, friday-sunday.

GROCERY LIST:
${cleaned}

Return JSON with ALL items. Do not skip any:
{
  "recipes": [],
  "extras": [
    { "name": "product name", "quantity": 1, "unit": "ks" }
  ]
}`;

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  logger.debug('AI raw response', { text: text.substring(0, 500) });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    logger.error('AI returned no JSON', { text });
    throw new Error('AI parser returned no valid JSON');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  logger.info('AI parsed result', {
    recipes: parsed.recipes?.length ?? 0,
    extras: parsed.extras?.length ?? 0,
  });

  const validated = parsedMealPlanSchema.safeParse(parsed);

  if (!validated.success) {
    logger.error('AI output failed validation', {
      errors: validated.error.issues,
      raw: JSON.stringify(parsed).substring(0, 500),
    });
    throw new Error(`AI output validation failed: ${validated.error.message}`);
  }

  return validated.data;
}
