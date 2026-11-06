// the controller imports provider / upload / auth modules that are not under test
jest.mock('@gitroom/nestjs-libraries/database/prisma/posts/posts.service', () => ({
  PostsService: class {},
}));
jest.mock('@gitroom/nestjs-libraries/track/track.service', () => ({
  TrackService: class {},
}));
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service',
  () => ({ SubscriptionService: class {} })
);
jest.mock('@gitroom/nestjs-libraries/dtos/webhooks/webhooks.dto', () => ({
  OnlyURL: class {},
}));
jest.mock('@gitroom/nestjs-libraries/dtos/comments/add.comment.dto', () => ({
  CreatePublicCommentDto: class {},
}));
jest.mock('@gitroom/helpers/auth/auth.service', () => ({ AuthService: {} }));
jest.mock('@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator', () => ({
  isSafePublicHttpsUrl: jest.fn(),
}));
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing',
  () => ({ pricing: {} })
);

import { PublicController } from '@gitroom/backend/api/routes/public.controller';
import { isSafePublicHttpsUrl } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';

const safeUrl = isSafePublicHttpsUrl as jest.Mock;

describe('PublicController.getPreview', () => {
  it('only exposes the fields the preview page renders', async () => {
    const getPostsRecursively = jest.fn().mockResolvedValue([
      {
        id: 'p-1',
        organizationId: 'org-A',
        integrationId: 'int-1',
        group: 'secret-group',
        batchId: 'batch-1',
        settings: '{"token":"x"}',
        state: 'PUBLISHED',
        releaseURL: 'https://x.com/acme/status/1',
        error: 'boom',
        lastMessageId: 'm-1',
        submittedForOrganizationId: 'org-B',
        publishDate: new Date('2026-01-01T00:00:00Z'),
        creationMethod: 'API',
        content: '<p>hi</p>',
        image: '[]',
        childrenPost: [],
        tags: [],
        integration: {
          id: 'int-1',
          name: 'Acme',
          picture: 'pic.png',
          providerIdentifier: 'x',
          profile: 'acme',
          token: 'oauth-token',
          refreshToken: 'oauth-refresh',
        },
      },
    ]);
    const controller = new PublicController(
      {} as any,
      { getPostsRecursively, publicReleaseURL: jest.fn() } as any,
      {} as any
    );

    const [preview] = (await controller.getPreview('p-1')) as any[];

    expect(preview).not.toHaveProperty('group');
    expect(Object.keys(preview).sort()).toEqual(
      [
        'content',
        'creationMethod',
        'id',
        'image',
        'integration',
        'organizationId',
        'publishDate',
      ].sort()
    );
    expect(Object.keys(preview.integration).sort()).toEqual(
      ['id', 'name', 'picture', 'profile', 'providerIdentifier'].sort()
    );

    expect(preview).not.toHaveProperty('publishedLink');
  });
});

describe('PublicController.getPreview published link', () => {
  const row = (overrides: any = {}) => ({
    id: 'p-1',
    organizationId: 'org-A',
    publishDate: new Date('2026-01-01T00:00:00Z'),
    creationMethod: 'API',
    content: '<p>hi</p>',
    image: '[]',
    state: 'PUBLISHED',
    releaseURL: 'https://x.com/acme/status/1',
    settings: '{}',
    childrenPost: [],
    integration: {
      id: 'int-1',
      name: 'Acme',
      picture: 'pic.png',
      providerIdentifier: 'x',
      profile: 'acme',
      token: 'oauth-token',
    },
    ...overrides,
  });

  const make = (posts: any[], link: any) => {
    const publicReleaseURL = jest.fn().mockReturnValue(link);
    const controller = new PublicController(
      {} as any,
      {
        getPostsRecursively: jest.fn().mockResolvedValue(posts),
        publicReleaseURL,
      } as any,
      {} as any
    );
    return { controller, publicReleaseURL };
  };

  beforeEach(() => safeUrl.mockReset());

  it('links the post when the provider opted in and the URL is safe', async () => {
    safeUrl.mockResolvedValue(true);
    const { controller, publicReleaseURL } = make([row()], {
      url: 'https://x.com/acme/status/1',
    });

    const [preview] = (await controller.getPreview('p-1')) as any[];

    expect(preview.publishedLink).toEqual({
      url: 'https://x.com/acme/status/1',
    });
    expect(safeUrl).toHaveBeenCalledWith('https://x.com/acme/status/1');
    // the decision is the service's, made from the whole stored row
    expect(publicReleaseURL).toHaveBeenCalledWith(
      expect.objectContaining({ releaseURL: 'https://x.com/acme/status/1' })
    );
  });

  it("passes the provider's own link label through", async () => {
    safeUrl.mockResolvedValue(true);
    const { controller } = make([row()], {
      url: 'https://x.com/acme/status/1',
      label: 'Open on X',
    });

    const [preview] = (await controller.getPreview('p-1')) as any[];

    expect(preview.publishedLink).toEqual({
      url: 'https://x.com/acme/status/1',
      label: 'Open on X',
    });
  });

  it('never links a release URL the service kept private', async () => {
    const { controller } = make(
      [
        row({
          providerIdentifier: 'tiktok',
          releaseURL: 'https://www.tiktok.com/messages?lang=en#7300000000',
        }),
      ],
      undefined
    );

    const [preview] = (await controller.getPreview('p-1')) as any[];

    expect(preview).not.toHaveProperty('publishedLink');
    // nothing to validate, so the URL check is not even reached
    expect(safeUrl).not.toHaveBeenCalled();
  });

  it('drops a URL that is not a public https URL, whatever the provider said', async () => {
    safeUrl.mockResolvedValue(false);
    const { controller } = make(
      [row({ releaseURL: 'https://listmonk.acme.internal/api/campaigns/4/preview' })],
      { url: 'https://listmonk.acme.internal/api/campaigns/4/preview' }
    );

    const [preview] = (await controller.getPreview('p-1')) as any[];

    expect(preview).not.toHaveProperty('publishedLink');
    expect(safeUrl).toHaveBeenCalledWith(
      'https://listmonk.acme.internal/api/campaigns/4/preview'
    );
  });

  it('decides each post of a thread on its own', async () => {
    safeUrl.mockResolvedValue(true);
    const publicReleaseURL = jest
      .fn()
      .mockReturnValueOnce({ url: 'https://x.com/acme/status/1' })
      .mockReturnValueOnce(undefined);
    const controller = new PublicController(
      {} as any,
      {
        getPostsRecursively: jest
          .fn()
          .mockResolvedValue([row(), row({ id: 'p-2' })]),
        publicReleaseURL,
      } as any,
      {} as any
    );

    const [first, second] = (await controller.getPreview('p-1')) as any[];

    expect(first.publishedLink).toEqual({ url: 'https://x.com/acme/status/1' });
    expect(second).not.toHaveProperty('publishedLink');
  });
});
