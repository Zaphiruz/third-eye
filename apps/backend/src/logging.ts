import type { FastifyServerOptions } from 'fastify';

export interface SerializableRequest { method: string; url: string; ip?: string }

/** Logs the request PATH only — query strings can carry OIDC codes and state. */
export function serializeRequest(req: SerializableRequest) {
  const url = req.url ?? '';
  const cut = url.search(/[?#]/);
  return { method: req.method, url: cut === -1 ? url : url.slice(0, cut), remoteAddress: req.ip };
}

export const loggerOptions = {
  redact: { paths: ['req.headers.cookie', 'req.headers.authorization'], remove: true },
  serializers: { req: serializeRequest },
} satisfies FastifyServerOptions['logger'];
