import type { FastifyInstance } from 'fastify';
import type { PrismaClient, User } from '@prisma/client';
import type { MeDto, ProfileDto } from '@third-eye/shared';
import { fromDbDate } from '../lib/dates.js';

export function serializeProfile(u: User): ProfileDto {
  return {
    birthDate: u.birthDate ? fromDbDate(u.birthDate) : null,
    fullName: u.fullName,
    bloodType: u.bloodType,
    timeZone: u.timeZone,
    persona: u.persona,
  };
}

export function registerProfileRoutes(app: FastifyInstance, deps: { prisma: PrismaClient }): void {
  app.get('/api/me', { preHandler: app.requireAuth }, async (req) => {
    const u = await deps.prisma.user.findUniqueOrThrow({ where: { sub: req.user!.sub } });
    const profile = serializeProfile(u);
    const data: MeDto = { user: req.user!, profile, onboarded: profile.birthDate !== null };
    return { data };
  });
}
