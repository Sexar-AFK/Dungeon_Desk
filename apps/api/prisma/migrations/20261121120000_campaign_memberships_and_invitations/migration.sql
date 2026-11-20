CREATE TYPE "CampaignRole" AS ENUM ('DM', 'PLAYER');

CREATE TABLE "CampaignMembership" (
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CampaignRole" NOT NULL DEFAULT 'PLAYER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignMembership_pkey" PRIMARY KEY ("campaignId", "userId")
);

-- Preserve existing access by making every campaign owner its initial DM.
INSERT INTO "CampaignMembership" ("campaignId", "userId", "role")
SELECT "id", "ownerId", 'DM'::"CampaignRole" FROM "Campaign";

CREATE INDEX "CampaignMembership_userId_createdAt_idx"
ON "CampaignMembership"("userId", "createdAt");

ALTER TABLE "CampaignMembership"
ADD CONSTRAINT "CampaignMembership_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignMembership"
ADD CONSTRAINT "CampaignMembership_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CampaignInvitation" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "role" "CampaignRole" NOT NULL DEFAULT 'PLAYER',
    "tokenHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "CampaignInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignInvitation_tokenHash_key" ON "CampaignInvitation"("tokenHash");
CREATE INDEX "CampaignInvitation_campaignId_email_expiresAt_idx"
ON "CampaignInvitation"("campaignId", "email", "expiresAt");
CREATE INDEX "CampaignInvitation_invitedByUserId_createdAt_idx"
ON "CampaignInvitation"("invitedByUserId", "createdAt");

ALTER TABLE "CampaignInvitation"
ADD CONSTRAINT "CampaignInvitation_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignInvitation"
ADD CONSTRAINT "CampaignInvitation_invitedByUserId_fkey"
FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
