-- AlterTable
ALTER TABLE "token_families" ADD COLUMN     "compromisedAt" TIMESTAMP(3),
ADD COLUMN     "mfaVerifiedAt" TIMESTAMP(3);
