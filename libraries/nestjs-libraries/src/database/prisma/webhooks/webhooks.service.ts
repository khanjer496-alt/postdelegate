import { Injectable, NotFoundException } from '@nestjs/common';
import { WebhooksRepository } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.repository';
import { WebhooksDto } from '@gitroom/nestjs-libraries/dtos/webhooks/webhooks.dto';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';

@Injectable()
export class WebhooksService {
  constructor(private _webhooksRepository: WebhooksRepository) {}

  getTotal(orgId: string) {
    return this._webhooksRepository.getTotal(orgId);
  }

  getWebhooks(orgId: string) {
    return this._webhooksRepository.getWebhooks(orgId);
  }

  createWebhook(orgId: string, body: WebhooksDto) {
    return this._webhooksRepository.createWebhook(orgId, body);
  }

  // What a published post fires. With billing on, only as many webhooks as
  // the plan holds (the oldest first): a downgrade stops the extra ones
  // without deleting them, and an upgrade brings them back
  async getWebhooksToSend(orgId: string) {
    const webhooks = await this._webhooksRepository.getWebhooks(orgId);
    if (!process.env.STRIPE_PUBLISHABLE_KEY) {
      return webhooks;
    }
    const tier = await this._webhooksRepository.getSubscriptionTier(orgId);
    return webhooks.slice(0, pricing[tier || 'FREE'].webhooks);
  }

  async updateWebhook(orgId: string, body: WebhooksDto) {
    const updated = await this._webhooksRepository.updateWebhook(orgId, body);
    if (!updated) {
      throw new NotFoundException('Webhook not found');
    }
    return updated;
  }

  deleteWebhook(orgId: string, id: string) {
    return this._webhooksRepository.deleteWebhook(orgId, id);
  }
}
