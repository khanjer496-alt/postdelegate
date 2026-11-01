import { NotFoundException } from '@nestjs/common';
import { WebhooksRepository } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.repository';
import { WebhooksService } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.service';

const makeRepo = (existing: { id: string } | null) => {
  const webhooks = {
    findFirst: jest.fn(async () => existing),
    create: jest.fn(async () => ({ id: 'new' })),
    update: jest.fn(async () => ({})),
    upsert: jest.fn(),
  };
  const integration = {
    findMany: jest.fn(async () => [{ id: 'i1' }]),
  };
  const repo = new WebhooksRepository(
    { model: { webhooks } } as any,
    { model: { integration } } as any
  );
  return { repo, webhooks };
};

const body = {
  id: 'w1',
  name: 'Hook',
  url: 'https://example.com/hook',
  integrations: [{ id: 'i1' }],
};

describe('WebhooksRepository', () => {
  it('updates an existing webhook of the organization', async () => {
    const { repo, webhooks } = makeRepo({ id: 'w1' });

    await expect(repo.updateWebhook('org-1', body)).resolves.toEqual({ id: 'w1' });
    expect(webhooks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'w1', organizationId: 'org-1', deletedAt: null },
      })
    );
    expect(webhooks.update).toHaveBeenCalledTimes(1);
    expect(webhooks.create).not.toHaveBeenCalled();
    expect(webhooks.upsert).not.toHaveBeenCalled();
  });

  it('never creates a webhook for an unknown id', async () => {
    const { repo, webhooks } = makeRepo(null);

    await expect(repo.updateWebhook('org-1', body)).resolves.toBeNull();
    expect(webhooks.update).not.toHaveBeenCalled();
    expect(webhooks.create).not.toHaveBeenCalled();
    expect(webhooks.upsert).not.toHaveBeenCalled();
  });

  it('creates a new webhook even when an id is sent', async () => {
    const { repo, webhooks } = makeRepo({ id: 'w1' });

    await expect(repo.createWebhook('org-1', body)).resolves.toEqual({ id: 'new' });
    expect(webhooks.create).toHaveBeenCalledTimes(1);
    expect(webhooks.update).not.toHaveBeenCalled();
  });
});

describe('WebhooksService.updateWebhook', () => {
  it('answers 404 for an unknown webhook', async () => {
    const { repo } = makeRepo(null);
    const service = new WebhooksService(repo);

    await expect(service.updateWebhook('org-1', body)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
