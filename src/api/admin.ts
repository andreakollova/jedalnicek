import type { FastifyInstance } from 'fastify';
import { getAllRecipes } from '../recipes/service.js';
import { getCurrentWeekPlan, getPlanItems } from '../db/plans.js';
import { getInventory } from '../db/inventory.js';

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function registerAdminRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  app.get('/api/recipes', async () => {
    const recipes = await getAllRecipes();
    return { recipes };
  });

  app.get('/api/plan/current', async () => {
    const today = getTodayDate();
    const plan = await getCurrentWeekPlan(today);
    if (!plan) return { plan: null, items: [] };
    const items = await getPlanItems(plan.id);
    return { plan, items };
  });

  app.get('/api/inventory', async () => {
    const inventory = await getInventory();
    return { inventory };
  });
}
