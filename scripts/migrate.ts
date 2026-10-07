/**
 * Migration script for Jedalnicek.
 *
 * Since Supabase doesn't expose a raw SQL execution endpoint via REST,
 * this script creates tables using the Supabase client's insert/upsert
 * combined with a bootstrap approach.
 *
 * USAGE: Copy the SQL from supabase/migrations/ into the Supabase SQL Editor at:
 * https://supabase.com/dashboard/project/mmgjjdbwfxjdhazcqgzo/sql
 *
 * Then run this script to verify and seed data:
 *   npx tsx scripts/migrate.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mmgjjdbwfxjdhazcqgzo.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tZ2pqZGJ3ZnhqZGhhemNxZ3pvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQwNzY4OCwiZXhwIjoyMDkxOTgzNjg4fQ.G2Ton6l55h8qqTXFdblSg9cdXdxe0pYiE59_MG6vUZY';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkTables() {
  const tables = ['ingredients', 'recipes', 'recipe_ingredients', 'weekly_plans',
    'weekly_plan_items', 'inventory', 'product_matches', 'shopping_runs',
    'shopping_run_items', 'shopping_preferences', 'automation_logs'];

  console.log('Checking tables...\n');

  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    const status = error ? 'MISSING' : 'OK';
    console.log(`  ${table}: ${status}${error ? ` (${error.message})` : ''}`);
  }
}

async function seedData() {
  console.log('\nSeeding ingredients...');

  const ingredients = [
    { canonical_name: 'kuracie prsia', aliases: ['chicken breast', 'kuracie', 'chicken'], default_unit: 'g', category: 'meat' },
    { canonical_name: 'ryza', aliases: ['rice', 'basmati', 'jasminova ryza'], default_unit: 'g', category: 'dry_food' },
    { canonical_name: 'kokosove mlieko', aliases: ['coconut milk', 'kokosove mleko'], default_unit: 'plechovka', category: 'dry_food' },
    { canonical_name: 'cibula', aliases: ['onion', 'cipula'], default_unit: 'ks', category: 'vegetables' },
    { canonical_name: 'cesnak', aliases: ['garlic', 'cesnok'], default_unit: 'stucik', category: 'vegetables' },
    { canonical_name: 'kari korenie', aliases: ['curry seasoning', 'curry powder', 'kari'], default_unit: 'lzicka', category: 'dry_food' },
    { canonical_name: 'losos', aliases: ['salmon', 'lososos filet'], default_unit: 'g', category: 'fish' },
    { canonical_name: 'zemiaky', aliases: ['potatoes', 'brambory'], default_unit: 'g', category: 'vegetables' },
    { canonical_name: 'olivovy olej', aliases: ['olive oil', 'olej'], default_unit: 'lzica', category: 'dry_food' },
    { canonical_name: 'sol', aliases: ['salt'], default_unit: 'lzicka', category: 'dry_food' },
    { canonical_name: 'cierny korenie', aliases: ['black pepper', 'pepper', 'korenie'], default_unit: 'lzicka', category: 'dry_food' },
    { canonical_name: 'citron', aliases: ['lemon', 'citron'], default_unit: 'ks', category: 'fruit' },
    { canonical_name: 'cestoviny', aliases: ['pasta', 'spagety', 'penne', 'fusilli'], default_unit: 'g', category: 'dry_food' },
    { canonical_name: 'tuniakova konzerva', aliases: ['canned tuna', 'tuniak', 'tuna'], default_unit: 'plechovka', category: 'fish' },
    { canonical_name: 'paradajkova omacka', aliases: ['tomato sauce', 'passata', 'paradajky'], default_unit: 'ml', category: 'dry_food' },
    { canonical_name: 'parmezanovy syr', aliases: ['parmesan', 'parmezan', 'parmigiano'], default_unit: 'g', category: 'dairy' },
    { canonical_name: 'maslo', aliases: ['butter'], default_unit: 'g', category: 'dairy' },
    { canonical_name: 'vajcia', aliases: ['eggs', 'vajicka'], default_unit: 'ks', category: 'dairy' },
    { canonical_name: 'mlieko', aliases: ['milk', 'mleko'], default_unit: 'l', category: 'dairy' },
    { canonical_name: 'chlieb', aliases: ['bread', 'pecivo'], default_unit: 'ks', category: 'bakery' },
    { canonical_name: 'banany', aliases: ['bananas', 'banan'], default_unit: 'ks', category: 'fruit' },
    { canonical_name: 'mineralna voda', aliases: ['mineral water', 'mineralka'], default_unit: 'ks', category: 'drinks' },
    { canonical_name: 'paprika', aliases: ['bell pepper', 'pepper'], default_unit: 'ks', category: 'vegetables' },
    { canonical_name: 'brokolica', aliases: ['broccoli'], default_unit: 'ks', category: 'vegetables' },
    { canonical_name: 'smotana na varenie', aliases: ['cooking cream', 'smotana'], default_unit: 'ml', category: 'dairy' },
  ];

  const { data: ingData, error: ingError } = await supabase
    .from('ingredients')
    .upsert(ingredients, { onConflict: 'canonical_name' })
    .select();

  if (ingError) {
    console.log('  Error:', ingError.message);
    return;
  }
  console.log(`  Inserted ${ingData.length} ingredients`);

  // Build ingredient lookup
  const ingMap = new Map(ingData.map(i => [i.canonical_name, i.id]));

  // Seed recipes
  console.log('\nSeeding recipes...');

  const recipeData = [
    {
      name: 'Chicken Curry',
      aliases: ['kuracie kari', 'curry', 'kari'],
      default_portions: 2,
      instructions: 'Opraz cibulu, pridaj kari, kuracie, kokosove mlieko. Var 20 min. Podavaj s ryzou.',
      ingredients: [
        { name: 'kuracie prsia', quantity: 500, unit: 'g', qpp: 250 },
        { name: 'ryza', quantity: 250, unit: 'g', qpp: 125 },
        { name: 'kokosove mlieko', quantity: 1, unit: 'plechovka', qpp: null },
        { name: 'cibula', quantity: 1, unit: 'ks', qpp: null },
        { name: 'cesnak', quantity: 2, unit: 'stucik', qpp: 1 },
        { name: 'kari korenie', quantity: 2, unit: 'lzicka', qpp: 1 },
        { name: 'olivovy olej', quantity: 1, unit: 'lzica', qpp: null },
        { name: 'sol', quantity: 1, unit: 'lzicka', qpp: null },
      ],
    },
    {
      name: 'Losos so zemiakmi',
      aliases: ['salmon with potatoes', 'losos', 'salmon'],
      default_portions: 2,
      instructions: 'Opec lososa na panvici, zemiaky uvar. Podavaj s citronom a olivovym olejom.',
      ingredients: [
        { name: 'losos', quantity: 400, unit: 'g', qpp: 200 },
        { name: 'zemiaky', quantity: 600, unit: 'g', qpp: 300 },
        { name: 'olivovy olej', quantity: 2, unit: 'lzica', qpp: 1 },
        { name: 'citron', quantity: 1, unit: 'ks', qpp: null },
        { name: 'sol', quantity: 1, unit: 'lzicka', qpp: null },
        { name: 'cierny korenie', quantity: 1, unit: 'lzicka', qpp: null },
      ],
    },
    {
      name: 'Cestoviny s tuniakom',
      aliases: ['pasta with tuna', 'tuniak cestoviny', 'tuna pasta'],
      default_portions: 2,
      instructions: 'Uvar cestoviny. Na panvici opraz cesnak, pridaj paradajkovu omacku a tuniaka. Zmiesaj.',
      ingredients: [
        { name: 'cestoviny', quantity: 400, unit: 'g', qpp: 200 },
        { name: 'tuniakova konzerva', quantity: 2, unit: 'plechovka', qpp: 1 },
        { name: 'paradajkova omacka', quantity: 400, unit: 'ml', qpp: 200 },
        { name: 'cesnak', quantity: 3, unit: 'stucik', qpp: null },
        { name: 'olivovy olej', quantity: 2, unit: 'lzica', qpp: 1 },
        { name: 'parmezanovy syr', quantity: 50, unit: 'g', qpp: 25 },
        { name: 'sol', quantity: 1, unit: 'lzicka', qpp: null },
      ],
    },
    {
      name: 'Kuracie s brokolicou',
      aliases: ['chicken broccoli', 'kuracie brokolica'],
      default_portions: 2,
      instructions: 'Opraz kuracie, pridaj brokolicu a smotanu. Podavaj s ryzou.',
      ingredients: [
        { name: 'kuracie prsia', quantity: 500, unit: 'g', qpp: 250 },
        { name: 'brokolica', quantity: 1, unit: 'ks', qpp: null },
        { name: 'smotana na varenie', quantity: 200, unit: 'ml', qpp: 100 },
        { name: 'ryza', quantity: 250, unit: 'g', qpp: 125 },
        { name: 'cesnak', quantity: 2, unit: 'stucik', qpp: 1 },
        { name: 'olivovy olej', quantity: 1, unit: 'lzica', qpp: null },
        { name: 'sol', quantity: 1, unit: 'lzicka', qpp: null },
        { name: 'cierny korenie', quantity: 1, unit: 'lzicka', qpp: null },
      ],
    },
    {
      name: 'Losos s ryzou',
      aliases: ['salmon rice', 'losos ryza'],
      default_portions: 2,
      instructions: 'Opec lososa, uvar ryzu. Podavaj so zeleninou.',
      ingredients: [
        { name: 'losos', quantity: 400, unit: 'g', qpp: 200 },
        { name: 'ryza', quantity: 250, unit: 'g', qpp: 125 },
        { name: 'paprika', quantity: 1, unit: 'ks', qpp: null },
        { name: 'cibula', quantity: 1, unit: 'ks', qpp: null },
        { name: 'olivovy olej', quantity: 2, unit: 'lzica', qpp: 1 },
        { name: 'sol', quantity: 1, unit: 'lzicka', qpp: null },
      ],
    },
  ];

  for (const r of recipeData) {
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .upsert({
        name: r.name,
        aliases: r.aliases,
        default_portions: r.default_portions,
        instructions: r.instructions,
      }, { onConflict: 'name', ignoreDuplicates: true })
      .select()
      .single();

    if (recipeError) {
      // Try insert without onConflict since name isn't unique
      const { data: recipe2, error: e2 } = await supabase
        .from('recipes')
        .insert({
          name: r.name,
          aliases: r.aliases,
          default_portions: r.default_portions,
          instructions: r.instructions,
        })
        .select()
        .single();

      if (e2) {
        console.log(`  Skip ${r.name}: ${e2.message}`);
        continue;
      }

      // Insert ingredients for this recipe
      for (const ing of r.ingredients) {
        const ingredientId = ingMap.get(ing.name);
        if (!ingredientId) {
          console.log(`    Missing ingredient: ${ing.name}`);
          continue;
        }
        await supabase.from('recipe_ingredients').insert({
          recipe_id: recipe2!.id,
          ingredient_id: ingredientId,
          quantity: ing.quantity,
          unit: ing.unit,
          quantity_per_portion: ing.qpp,
        });
      }
      console.log(`  Created: ${r.name} (${r.ingredients.length} ingredients)`);
      continue;
    }

    // Insert ingredients for this recipe
    for (const ing of r.ingredients) {
      const ingredientId = ingMap.get(ing.name);
      if (!ingredientId) {
        console.log(`    Missing ingredient: ${ing.name}`);
        continue;
      }
      await supabase.from('recipe_ingredients').insert({
        recipe_id: recipe!.id,
        ingredient_id: ingredientId,
        quantity: ing.quantity,
        unit: ing.unit,
        quantity_per_portion: ing.qpp,
      });
    }
    console.log(`  Created: ${r.name} (${r.ingredients.length} ingredients)`);
  }

  // Seed preferences
  console.log('\nSeeding preferences...');
  const prefs = [
    { key: 'preferred_brands', value: [] },
    { key: 'blocked_brands', value: [] },
    { key: 'max_acceptable_price', value: 50 },
    { key: 'prefer_cheapest_per_unit', value: true },
    { key: 'allow_substitutions', value: true },
    { key: 'max_substitution_price_diff', value: 2 },
    { key: 'min_match_confidence', value: 'medium' },
  ];

  for (const p of prefs) {
    await supabase.from('shopping_preferences').upsert(
      { key: p.key, value: p.value },
      { onConflict: 'key' }
    );
  }
  console.log(`  Inserted ${prefs.length} preferences`);
}

async function main() {
  console.log('=== Jedalnicek Migration ===\n');
  await checkTables();

  // Check if tables exist by testing ingredients
  const { error } = await supabase.from('ingredients').select('id').limit(1);
  if (error) {
    console.log('\n--- TABLES DO NOT EXIST ---');
    console.log('Please run the SQL from supabase/migrations/001_initial_schema.sql');
    console.log('in the Supabase SQL Editor at:');
    console.log('https://supabase.com/dashboard/project/mmgjjdbwfxjdhazcqgzo/sql/new');
    console.log('\nThen re-run this script to seed data.');
    return;
  }

  await seedData();
  console.log('\nDone!');
}

main().catch(console.error);
