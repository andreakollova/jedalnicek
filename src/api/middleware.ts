import type { FastifyRequest, FastifyReply } from 'fastify';
import { getEnv } from '../config/env.js';

export async function requireCronSecret(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${getEnv().CRON_SECRET}`) {
    reply.code(401).send({ error: 'Unauthorized' });
    return reply;
  }
}
