import type { FastifyInstance } from 'fastify';
import { requireCronSecret } from './middleware.js';
import { sendShoppingPrompt } from '../slack/app.js';
import { createLog, completeLog } from '../db/logs.js';
import { logger } from '../utils/logger.js';

export function registerJobRoutes(app: FastifyInstance) {
  // Mon/Wed/Fri morning prompt - asks user what they want to eat
  app.post('/api/jobs/prompt/:day', {
    preHandler: [requireCronSecret],
  }, async (request, reply) => {
    const { day } = request.params as { day: string };

    if (!['monday', 'wednesday', 'friday'].includes(day)) {
      reply.code(400).send({ error: 'Invalid day. Must be monday, wednesday, or friday.' });
      return;
    }

    const log = await createLog({ job: `prompt-${day}` });

    try {
      await sendShoppingPrompt(day as 'monday' | 'wednesday' | 'friday');
      await completeLog(log.id, 'completed');
      reply.send({ status: 'ok', message: `Prompt sent for ${day}` });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await completeLog(log.id, 'failed', msg);
      logger.error(`Prompt job failed for ${day}`, { error: msg });
      reply.code(500).send({ status: 'error', message: msg });
    }
  });

  // Shopping run - prepares Kosik cart (Phase 3)
  app.post('/api/jobs/shopping/:day', {
    preHandler: [requireCronSecret],
  }, async (request, reply) => {
    const { day } = request.params as { day: string };

    if (!['monday', 'wednesday', 'friday'].includes(day)) {
      reply.code(400).send({ error: 'Invalid day.' });
      return;
    }

    const log = await createLog({ job: `shopping-${day}` });

    try {
      logger.info(`Shopping run triggered for ${day}`);
      // Phase 3: Kosik cart preparation will go here
      await completeLog(log.id, 'completed');
      reply.send({ status: 'ok', message: `Shopping run for ${day} (Kosik not yet connected)` });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await completeLog(log.id, 'failed', msg);
      reply.code(500).send({ status: 'error', message: msg });
    }
  });
}
