-- Additive only. Apply before the application; no existing keys are touched.
CREATE TYPE "AgentCredentialRole" AS ENUM ('ANALYST', 'DRAFT_ONLY', 'PUBLISHER');
CREATE TABLE "AgentCredential" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "role" "AgentCredentialRole" NOT NULL DEFAULT 'DRAFT_ONLY',
  "channelIds" JSONB,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AgentCredential_secretHash_key" ON "AgentCredential"("secretHash");
CREATE INDEX "AgentCredential_organizationId_createdAt_idx" ON "AgentCredential"("organizationId", "createdAt");
