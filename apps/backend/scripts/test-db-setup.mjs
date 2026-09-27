import { execSync } from 'node:child_process';
const URL_ = process.env.TEST_DATABASE_URL ?? 'postgres://third_eye:third_eye@localhost:5435/third_eye_test';
try {
  execSync('docker compose exec -T postgres psql -U third_eye -d third_eye -c "CREATE DATABASE third_eye_test"', {
    stdio: 'inherit', cwd: new URL('../../..', import.meta.url),
  });
} catch { /* already exists */ }
execSync('corepack pnpm exec prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: URL_ } });
