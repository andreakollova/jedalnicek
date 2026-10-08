import 'dotenv/config';
import { getDb } from '../src/db/client.js';
import { getPlanItems } from '../src/db/plans.js';
import { buildShoppingList } from '../src/shopping/planner.js';

async function main() {
  const db = getDb();

  const { data: plans } = await db.from('weekly_plans').select('*').eq('week_start', '2026-10-08');
  const plan = plans?.[0];
  if (!plan) { console.log('No plan for today'); return; }
  console.log('Plan:', plan.id.substring(0, 8), plan.status);

  const items = await getPlanItems(plan.id);
  console.log('\ngetPlanItems returned:', items.length, 'items');
  items.forEach(i => console.log('  ', i.type, '| notes:', i.notes, '| ingredient_id:', i.ingredient_id, '| qty:', i.quantity, i.unit));

  const list = await buildShoppingList(items);
  console.log('\nbuildShoppingList returned:', list.length, 'items');
  list.forEach(l => console.log('  ', l.ingredient_name, l.total_quantity, l.unit));
}

main().catch(console.error);
