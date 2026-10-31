import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AiCredentialRepository {
  constructor(private _aiCredential: PrismaRepository<'aiCredential'>) {}

  getByOrg(orgId: string) {
    return this._aiCredential.model.aiCredential.findUnique({
      where: { organizationId: orgId },
    });
  }

  upsert(orgId: string, provider: string, encryptedKey: string) {
    return this._aiCredential.model.aiCredential.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        provider,
        apiKey: encryptedKey,
      },
      update: {
        provider,
        apiKey: encryptedKey,
      },
    });
  }

  deleteByOrg(orgId: string) {
    return this._aiCredential.model.aiCredential.deleteMany({
      where: { organizationId: orgId },
    });
  }
}
