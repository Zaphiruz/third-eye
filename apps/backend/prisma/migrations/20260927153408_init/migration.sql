-- CreateEnum
CREATE TYPE "Persona" AS ENUM ('MYSTIC', 'CONFIDANT', 'TRICKSTER');

-- CreateEnum
CREATE TYPE "BloodType" AS ENUM ('A', 'B', 'AB', 'O');

-- CreateEnum
CREATE TYPE "FortuneStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "Method" AS ENUM ('TAROT', 'RUNE', 'ICHING', 'WESTERN', 'CHINESE', 'NUMEROLOGY', 'BLOODTYPE');

-- CreateTable
CREATE TABLE "users" (
    "sub" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "birth_date" DATE,
    "full_name" TEXT,
    "blood_type" "BloodType",
    "time_zone" TEXT NOT NULL DEFAULT 'UTC',
    "persona" "Persona" NOT NULL DEFAULT 'CONFIDANT',
    "last_login_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("sub")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id_hash" TEXT NOT NULL,
    "user_sub" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id_hash")
);

-- CreateTable
CREATE TABLE "fortunes" (
    "id" UUID NOT NULL,
    "user_sub" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "FortuneStatus" NOT NULL DEFAULT 'PENDING',
    "persona" "Persona" NOT NULL,
    "profile_snapshot" JSONB NOT NULL,
    "summary" TEXT,
    "model" TEXT,
    "prompt_version" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fortunes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fortune_results" (
    "id" UUID NOT NULL,
    "fortune_id" UUID NOT NULL,
    "method" "Method" NOT NULL,
    "data" JSONB NOT NULL,
    "reading" TEXT,

    CONSTRAINT "fortune_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "fortunes_user_sub_date_key" ON "fortunes"("user_sub", "date");

-- CreateIndex
CREATE UNIQUE INDEX "fortune_results_fortune_id_method_key" ON "fortune_results"("fortune_id", "method");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_sub_fkey" FOREIGN KEY ("user_sub") REFERENCES "users"("sub") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fortunes" ADD CONSTRAINT "fortunes_user_sub_fkey" FOREIGN KEY ("user_sub") REFERENCES "users"("sub") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fortune_results" ADD CONSTRAINT "fortune_results_fortune_id_fkey" FOREIGN KEY ("fortune_id") REFERENCES "fortunes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
