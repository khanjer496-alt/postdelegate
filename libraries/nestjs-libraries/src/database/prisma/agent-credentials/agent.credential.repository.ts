import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export const credentialMetadata = {
  id: true,
  name: true,
  role: true,
  channelIds: true,
  expiresAt: true,
  revokedAt: true,
  createdAt: true,
} as const;
@Injectable()
export class AgentCredentialRepository {
  constructor(private db: PrismaService) {}
  list(organizationId: string) {
    return this.db.agentCredential.findMany({
      where: { organizationId },
      select: credentialMetadata,
      orderBy: { createdAt: 'desc' },
    });
  }
  create(data: any) {
    return this.db.agentCredential.create({ data, select: credentialMetadata });
  }
  revoke(organizationId: string, id: string) {
    return this.db.agentCredential.updateMany({
      where: { id, organizationId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  byHash(secretHash: string) {
    return this.db.agentCredential.findUnique({
      where: { secretHash },
      include: { organization: { include: { subscription: true } } },
    });
  }
  byId(id: string) {
    return this.db.agentCredential.findUnique({
      where: { id },
      include: { organization: { select: { deletedAt: true } } },
    });
  }
  channels(organizationId: string, ids: string[]) {
    return this.db.integration.findMany({
      where: { organizationId, id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
  }
  post(organizationId: string, id: string) {
    return this.db.post.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
        integration: { deletedAt: null },
      },
      select: { id: true, integrationId: true, state: true, releaseId: true },
    });
  }
}
