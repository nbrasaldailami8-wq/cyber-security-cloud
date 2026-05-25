-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "mfaVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "token_families" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "token_families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_generations" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "parentGenerationId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "token_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_challenges" (
    "id" TEXT NOT NULL,
    "challengeHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "web_authn_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "signCount" INTEGER NOT NULL DEFAULT 0,
    "transports" TEXT[],
    "backupEligible" BOOLEAN NOT NULL DEFAULT false,
    "backupState" BOOLEAN NOT NULL DEFAULT false,
    "deviceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "web_authn_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "web_authn_challenges" (
    "id" TEXT NOT NULL,
    "challengeHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "web_authn_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "token_families_userId_idx" ON "token_families"("userId");

-- CreateIndex
CREATE INDEX "token_families_userId_revokedAt_idx" ON "token_families"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "token_generations_refreshTokenHash_key" ON "token_generations"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "token_generations_familyId_idx" ON "token_generations"("familyId");

-- CreateIndex
CREATE INDEX "token_generations_familyId_generation_idx" ON "token_generations"("familyId", "generation");

-- CreateIndex
CREATE INDEX "token_generations_refreshTokenHash_idx" ON "token_generations"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "token_generations_createdAt_idx" ON "token_generations"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_tokenHash_idx" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "mfa_challenges_challengeHash_key" ON "mfa_challenges"("challengeHash");

-- CreateIndex
CREATE INDEX "mfa_challenges_challengeHash_idx" ON "mfa_challenges"("challengeHash");

-- CreateIndex
CREATE INDEX "mfa_challenges_userId_idx" ON "mfa_challenges"("userId");

-- CreateIndex
CREATE INDEX "mfa_challenges_expiresAt_idx" ON "mfa_challenges"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "web_authn_credentials_credentialId_key" ON "web_authn_credentials"("credentialId");

-- CreateIndex
CREATE INDEX "web_authn_credentials_userId_idx" ON "web_authn_credentials"("userId");

-- CreateIndex
CREATE INDEX "web_authn_credentials_userId_revokedAt_idx" ON "web_authn_credentials"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "web_authn_challenges_challengeHash_key" ON "web_authn_challenges"("challengeHash");

-- CreateIndex
CREATE INDEX "web_authn_challenges_challengeHash_idx" ON "web_authn_challenges"("challengeHash");

-- CreateIndex
CREATE INDEX "web_authn_challenges_userId_idx" ON "web_authn_challenges"("userId");

-- CreateIndex
CREATE INDEX "web_authn_challenges_expiresAt_idx" ON "web_authn_challenges"("expiresAt");

-- AddForeignKey
ALTER TABLE "token_families" ADD CONSTRAINT "token_families_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_generations" ADD CONSTRAINT "token_generations_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "token_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_generations" ADD CONSTRAINT "token_generations_parentGenerationId_fkey" FOREIGN KEY ("parentGenerationId") REFERENCES "token_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "web_authn_credentials" ADD CONSTRAINT "web_authn_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "web_authn_challenges" ADD CONSTRAINT "web_authn_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
