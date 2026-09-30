-- CreateTable
CREATE TABLE "shares" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "fortune_id" UUID NOT NULL,
    "user_sub" TEXT NOT NULL,
    "shared_by_name" TEXT NOT NULL,
    "include_birth_signs" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shares_token_key" ON "shares"("token");

-- CreateIndex
CREATE INDEX "shares_fortune_id_idx" ON "shares"("fortune_id");

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_fortune_id_fkey" FOREIGN KEY ("fortune_id") REFERENCES "fortunes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_user_sub_fkey" FOREIGN KEY ("user_sub") REFERENCES "users"("sub") ON DELETE CASCADE ON UPDATE CASCADE;
