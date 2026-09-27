import type { FastifyInstance } from 'fastify';
import type { PrismaClient, User } from '@prisma/client';
import type { MeDto, ProfileDto } from '@third-eye/shared';
import { profileUpdateSchema } from '@third-eye/shared';
import { fromDbDate, toDbDate } from '../lib/dates.js';
import { parse } from '../errors.js';

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

  app.patch('/api/me', { preHandler: app.requireAuth }, async (req) => {
    const input = parse(profileUpdateSchema, req.body);
    const u = await deps.prisma.user.update({
      where: { sub: req.user!.sub },
      data: {
        ...(input.birthDate !== undefined ? { birthDate: toDbDate(input.birthDate) } : {}),
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.bloodType !== undefined ? { bloodType: input.bloodType } : {}),
        ...(input.timeZone !== undefined ? { timeZone: input.timeZone } : {}),
        ...(input.persona !== undefined ? { persona: input.persona } : {}),
      },
    });
    const profile = serializeProfile(u);
    const data: MeDto = { user: req.user!, profile, onboarded: profile.birthDate !== null };
    return { data };
  });
}
