-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "mcpWorkflowVersion" INTEGER;

-- CreateTable
CREATE TABLE "McpAgentAdmission" (
    "organizationId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL DEFAULT 'unknown',
    "host" TEXT NOT NULL DEFAULT 'unknown',
    "processId" INTEGER NOT NULL DEFAULT 0,
    "writtenPostIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpAgentAdmission_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "McpAgentAdmissionRecovery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "writtenPostIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpAgentAdmissionRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpPublishFence" (
    "postId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "revisionHash" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "generation" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpPublishFence_pkey" PRIMARY KEY ("postId")
);

-- CreateTable
CREATE TABLE "McpPublishAttempt" (
    "id" TEXT NOT NULL,
    "rootPostId" TEXT NOT NULL,
    "segmentPostId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "revisionHash" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "receipt" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpPublishAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "McpAgentAdmissionRecovery_organizationId_idx" ON "McpAgentAdmissionRecovery"("organizationId");

-- CreateIndex
CREATE INDEX "McpPublishFence_organizationId_idx" ON "McpPublishFence"("organizationId");

-- CreateIndex
CREATE INDEX "McpPublishAttempt_organizationId_rootPostId_idx" ON "McpPublishAttempt"("organizationId", "rootPostId");

-- CreateIndex
CREATE UNIQUE INDEX "McpPublishAttempt_rootPostId_segmentPostId_revisionHash_gen_key" ON "McpPublishAttempt"("rootPostId", "segmentPostId", "revisionHash", "generation");

-- AddForeignKey
ALTER TABLE "McpAgentAdmission" ADD CONSTRAINT "McpAgentAdmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpAgentAdmissionRecovery" ADD CONSTRAINT "McpAgentAdmissionRecovery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpPublishFence" ADD CONSTRAINT "McpPublishFence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpPublishAttempt" ADD CONSTRAINT "McpPublishAttempt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

