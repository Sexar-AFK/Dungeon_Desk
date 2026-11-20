-- Add the initial local owner and attach existing campaigns before making the
-- ownership column required. The account is intentionally unusable until the
-- explicit setup command replaces its placeholder credentials.
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

INSERT INTO "User" ("id", "email", "passwordHash", "updatedAt")
VALUES ('local-setup-owner', 'setup-required@dungeon-desk.invalid', '!SETUP_REQUIRED!', CURRENT_TIMESTAMP);

ALTER TABLE "Campaign" ADD COLUMN "ownerId" TEXT;

UPDATE "Campaign" SET "ownerId" = 'local-setup-owner';

ALTER TABLE "Campaign" ALTER COLUMN "ownerId" SET NOT NULL;

CREATE INDEX "Campaign_ownerId_updatedAt_idx" ON "Campaign"("ownerId", "updatedAt");

ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Session" (
    "id" VARCHAR(64) NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL,
    "mfa" TEXT,
    "metadata" JSONB,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
