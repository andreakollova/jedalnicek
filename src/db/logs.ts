import { getDb } from './client.js';
import type { AutomationLog } from '../types/index.js';

export async function createLog(log: {
  job: string;
  run_id?: string;
  metadata?: unknown;
}): Promise<AutomationLog> {
  const { data, error } = await getDb()
    .from('automation_logs')
    .insert({
      job: log.job,
      run_id: log.run_id ?? null,
      status: 'started',
      metadata: log.metadata ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function completeLog(id: string, status: 'completed' | 'failed', error?: string): Promise<void> {
  const { error: dbError } = await getDb()
    .from('automation_logs')
    .update({
      status,
      error: error ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (dbError) throw dbError;
}
