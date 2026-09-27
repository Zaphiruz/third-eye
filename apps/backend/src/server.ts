import { PrismaClient } from '@prisma/client';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { loggerOptions } from './logging.js';

const config = loadConfig();
const prisma = new PrismaClient();

const app = await buildApp({
  logger: loggerOptions,
  trustProxyHops: config.trustProxyHops,
  prisma,
  frontendOrigin: config.frontendOrigin,
  sessionSecret: config.sessionSecret,
  cookieSecure: config.cookieSecure,
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    void app.close().then(() => prisma.$disconnect()).then(() => process.exit(0));
  });
}

await app.listen({ host: '0.0.0.0', port: config.port });
app.log.info({ model: config.anthropic.model, devBypass: config.devBypass }, 'third-eye backend ready');
