import {
  AuthorizationActions,
  Sections,
  SubscriptionException,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';
import { SubscriptionExceptionFilter } from './subscription.exception';

describe('SubscriptionExceptionFilter', () => {
  const realFrontendUrl = process.env.FRONTEND_URL;
  let json: jest.Mock;
  let status: jest.Mock;
  let host: any;

  beforeEach(() => {
    process.env.FRONTEND_URL = 'https://app.example.com';
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    };
  });

  afterEach(() => {
    if (realFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = realFrontendUrl;
    }
  });

  const deny = (section: Sections) =>
    new SubscriptionExceptionFilter().catch(
      new SubscriptionException({
        section,
        action: AuthorizationActions.Create,
      }),
      host
    );

  it('sends a workspace without an OpenAI key to Settings → AI, not billing', () => {
    deny(Sections.AI);

    expect(status).toHaveBeenCalledWith(402);
    expect(json).toHaveBeenCalledWith({
      statusCode: 402,
      message: 'Add your OpenAI key in Settings → AI',
      section: Sections.AI,
      url: 'https://app.example.com/settings?tab=ai',
    });
  });

  it('still sends a plan limit to billing', () => {
    deny(Sections.POSTS_PER_MONTH);

    expect(status).toHaveBeenCalledWith(402);
    expect(json).toHaveBeenCalledWith({
      statusCode: 402,
      message:
        'You have reached the maximum number of posts for your subscription. Please upgrade your subscription to add more posts.',
      section: Sections.POSTS_PER_MONTH,
      url: 'https://app.example.com/billing',
    });
  });
});
