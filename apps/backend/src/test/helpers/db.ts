import { PrismaClient } from '@prisma/client';

let client: PrismaClient | undefined;
export function getTestPrisma(): PrismaClient {
  client ??= new PrismaClient();
  return client;
}

export async function resetDatabase(): Promise<void> {
  const p = getTestPrisma();
  await p.fortuneResult.deleteMany();
  await p.fortune.deleteMany();
  await p.session.deleteMany();
  await p.user.deleteMany();
}
