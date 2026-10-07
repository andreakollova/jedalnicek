import type { FastifyInstance } from 'fastify';
import { registerJobRoutes } from './jobs.js';
import { registerAdminRoutes } from './admin.js';

export function registerRoutes(app: FastifyInstance) {
  registerAdminRoutes(app);
  registerJobRoutes(app);
}
