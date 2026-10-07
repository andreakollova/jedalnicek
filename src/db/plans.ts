import { getDb } from './client.js';
import type { WeeklyPlan, WeeklyPlanItem } from '../types/index.js';

export async function getCurrentWeekPlan(weekStart: string): Promise<WeeklyPlan | null> {
  const { data, error } = await getDb()
    .from('weekly_plans')
    .select('*')
    .eq('week_start', weekStart)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createWeeklyPlan(plan: {
  week_start: string;
  raw_message?: string;
  parsed_plan?: unknown;
  status?: string;
}): Promise<WeeklyPlan> {
  const { data, error } = await getDb()
    .from('weekly_plans')
    .upsert({
      week_start: plan.week_start,
      raw_message: plan.raw_message ?? null,
      parsed_plan: plan.parsed_plan ?? null,
      status: plan.status ?? 'draft',
    }, { onConflict: 'week_start' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateWeeklyPlan(id: string, updates: Partial<WeeklyPlan>): Promise<WeeklyPlan> {
  const { data, error } = await getDb()
    .from('weekly_plans')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getPlanItems(planId: string): Promise<WeeklyPlanItem[]> {
  const { data, error } = await getDb()
    .from('weekly_plan_items')
    .select('*, recipe:recipes(*), ingredient:ingredients(*)')
    .eq('plan_id', planId);
  if (error) throw error;
  return data;
}

export async function addPlanItem(item: {
  plan_id: string;
  type: 'recipe' | 'extra';
  recipe_id?: string;
  ingredient_id?: string;
  day_start: string;
  day_end: string;
  portions?: number;
  quantity?: number;
  unit?: string;
  notes?: string;
}): Promise<WeeklyPlanItem> {
  const { data, error } = await getDb()
    .from('weekly_plan_items')
    .insert({
      plan_id: item.plan_id,
      type: item.type,
      recipe_id: item.recipe_id ?? null,
      ingredient_id: item.ingredient_id ?? null,
      day_start: item.day_start,
      day_end: item.day_end,
      portions: item.portions ?? 1,
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
      notes: item.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function clearPlanItems(planId: string): Promise<void> {
  const { error } = await getDb()
    .from('weekly_plan_items')
    .delete()
    .eq('plan_id', planId);
  if (error) throw error;
}
