import type { FastifyInstance } from 'fastify';
import { shareCreateSchema } from '@third-eye/shared';
import { parse } from '../errors.js';
import { uuidParam } from '../lib/ids.js';
import type { ShareService } from './service.js';

export function registerShareRoutes(app: FastifyInstance, deps: { shares: ShareService }): void {
  const auth = { preHandler: app.requireAuth };

  app.post<{ Params: { id: string } }>('/api/fortunes/:id/shares',
    { ...auth, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const input = parse(shareCreateSchema, req.body);
      const data = await deps.shares.create(req.user!.sub, uuidParam(req.params.id), input);
      return reply.code(201).send({ data });
    });

  app.get<{ Params: { id: string } }>('/api/fortunes/:id/shares', auth, async (req) => ({
    data: await deps.shares.list(req.user!.sub, uuidParam(req.params.id)),
  }));

  app.delete<{ Params: { id: string } }>('/api/shares/:id', auth, async (req, reply) => {
    await deps.shares.revoke(req.user!.sub, uuidParam(req.params.id));
    return reply.code(204).send();
  });
}
