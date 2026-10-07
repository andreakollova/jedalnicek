import 'dotenv/config';
import Fastify from 'fastify';
import { loadEnv } from './config/env.js';
import { registerRoutes } from './api/routes.js';
import { getSlackApp } from './slack/app.js';
import { logger, setLogLevel } from './utils/logger.js';

async function main() {
  const env = loadEnv();
  setLogLevel(env.LOG_LEVEL);

  // Start Fastify
  const app = Fastify({ logger: false });
  registerRoutes(app);

  // Start Slack in socket mode
  const slack = getSlackApp();
  await slack.start();
  logger.info('Slack app started in socket mode');

  // Start HTTP server
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info(`Server listening on port ${env.PORT}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
