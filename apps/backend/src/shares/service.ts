import { randomBytes } from 'node:crypto';
import type { PrismaClient, Share } from '@prisma/client';
import { BIRTH_SIGN_METHODS, type FortuneDto, type ShareCreateInput, type ShareDto } from '@third-eye/shared';
import { AppError, notFound } from '../errors.js';
import { serializeFortune } from '../fortunes/serialize.js';

export const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;
export interface PublicShare { sharedByName: string; includeBirthSigns: boolean; fortune: FortuneDto }
export interface ShareService {
  create(userSub: string, fortuneId: string, input: ShareCreateInput): Promise<ShareDto>;
  list(userSub: string, fortuneId: string): Promise<ShareDto[]>;
  revoke(userSub: string, shareId: string): Promise<void>;
  findPublic(token: string): Promise<PublicShare | null>;
}

export function createShareService(deps: {
  prisma: PrismaClient; frontendOrigin: string; newToken?: () => string;
}): ShareService {
  const { prisma } = deps;
  const newToken = deps.newToken ?? (() => randomBytes(16).toString('base64url'));
  const toDto = (s: Share): ShareDto => ({
    id: s.id, url: `${deps.frontendOrigin}/s/${s.token}`, sharedByName: s.sharedByName,
    includeBirthSigns: s.includeBirthSigns, createdAt: s.createdAt.toISOString(),
  });

  async function ownFortune(userSub: string, fortuneId: string) {
    const f = await prisma.fortune.findFirst({ where: { id: fortuneId, userSub } });
    if (!f) throw notFound();
    return f;
  }

  return {
    async create(userSub, fortuneId, input) {
      const f = await ownFortune(userSub, fortuneId);
      if (f.status !== 'READY') throw new AppError(409, 'not_ready', "This reading isn't finished yet");
      const s = await prisma.share.create({
        data: { token: newToken(), fortuneId, userSub, sharedByName: input.sharedByName, includeBirthSigns: input.includeBirthSigns },
      });
      return toDto(s);
    },

    async list(userSub, fortuneId) {
      await ownFortune(userSub, fortuneId);
      const rows = await prisma.share.findMany({
        where: { fortuneId, userSub, revokedAt: null }, orderBy: { createdAt: 'desc' },
      });
      return rows.map(toDto);
    },

    async revoke(userSub, shareId) {
      const r = await prisma.share.updateMany({
        where: { id: shareId, userSub, revokedAt: null }, data: { revokedAt: new Date() },
      });
      if (r.count !== 1) throw notFound();
    },

    async findPublic(token) {
      if (!TOKEN_RE.test(token)) return null;
      const s = await prisma.share.findUnique({ where: { token }, include: { fortune: { include: { results: true } } } });
      if (!s || s.revokedAt || s.fortune.status !== 'READY') return null;
      const fortune = serializeFortune(s.fortune);
      if (!s.includeBirthSigns) fortune.results = fortune.results.filter((r) => !BIRTH_SIGN_METHODS.includes(r.method));
      return { sharedByName: s.sharedByName, includeBirthSigns: s.includeBirthSigns, fortune };
    },
  };
}
