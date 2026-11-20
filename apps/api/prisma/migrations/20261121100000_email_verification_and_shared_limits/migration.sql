ALTER TABLE "User"
ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- The first owner is explicitly provisioned by the local setup command; its
-- address is considered confirmed by that trusted, administrative process.
UPDATE "User" SET "emailVerified" = true WHERE "id" = 'local-setup-owner';

CREATE TABLE "EmailToken" (
    "id" VARCHAR(64) NOT NULL,
    "purpose" VARCHAR(32) NOT NULL,
    "userId" TEXT NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "fingerprint" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailToken_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailToken_userId_purpose_idx" ON "EmailToken"("userId", "purpose");
CREATE INDEX "EmailToken_expiresAt_idx" ON "EmailToken"("expiresAt");
ALTER TABLE "EmailToken" ADD CONSTRAINT "EmailToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RateLimit" (
    "key" VARCHAR(512) NOT NULL,
    "totalHits" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockExpiresAt" TIMESTAMP(3),
    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");
