import type { FastifyInstance } from 'fastify';
import { uuidParam } from '../lib/ids.js';
import type { FortuneService } from './service.js';

export function registerFortuneRoutes(app: FastifyInstance, deps: { fortunes: FortuneService }): void {
  const auth = { preHandler: app.requireAuth };

  app.post('/api/fortunes/today', { ...auth, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const data = await deps.fortunes.today(req.user!.sub);
    return reply.code(data.fresh ? 201 : 200).send({ data });
  });

  app.get<{ Params: { id: string } }>('/api/fortunes/:id', auth, async (req) => ({
    data: await deps.fortunes.get(req.user!.sub, uuidParam(req.params.id)),
  }));

  app.get<{ Querystring: { cursor?: string } }>('/api/fortunes', auth, async (req) => ({
    data: await deps.fortunes.history(req.user!.sub, req.query.cursor),
  }));
}
