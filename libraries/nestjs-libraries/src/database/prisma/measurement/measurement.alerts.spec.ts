import { MeasurementService, shortError } from './measurement.service';
import { measurementHash } from './acquisition';
jest.mock('./measurement.repository', () => ({
  MEASUREMENT_EXPORT_CAP: 100000,
  MeasurementRepository: class {},
}));
jest.mock('@gitroom/nestjs-libraries/integrations/integration.manager', () => ({
  IntegrationManager: class {},
}));

const make = (repository: object = {}, watches = true) => {
  const repo = {
    acquisition: jest.fn(async () => ({
      source: 'google',
      internalOrTest: false,
    })),
    exists: jest.fn(async (): Promise<{ key: string } | null> => null),
    save: jest.fn(async () => ({ key: 'k' })),
    channel: jest.fn(async () => ({
      providerIdentifier: 'linkedin',
      disabled: false,
      inBetweenSteps: false,
      deletedAt: null,
      refreshNeeded: false,
    })),
    failedPost: jest.fn(async (): Promise<object | null> => ({
      organizationId: 'org',
      integration: { providerIdentifier: 'x' },
    })),
    ...repository,
  };
  const alerts = {
    watches: jest.fn(() => watches),
    funnelEvent: jest.fn(async () => undefined),
  };
  return {
    service: new MeasurementService(repo as never, alerts as never),
    repo,
    alerts,
  };
};

describe('MeasurementService owner alerts', () => {
  it('alerts the first receipt of an event, never a replay', async () => {
    const { service, repo, alerts } = make();
    await service.record('org', 'trial_started', 'sub_1');
    expect(alerts.funnelEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org',
        kind: 'trial_started',
        internalOrTest: false,
        source: 'google',
      })
    );
    expect(repo.exists).toHaveBeenCalledWith(
      measurementHash('org|trial_started|sub_1')
    );

    alerts.funnelEvent.mockClear();
    repo.exists.mockResolvedValue({ key: 'k' });
    await service.record('org', 'trial_started', 'sub_1');
    expect(repo.save).toHaveBeenCalledTimes(2);
    expect(alerts.funnelEvent).not.toHaveBeenCalled();
  });

  it('asks nothing more of the database when alerts are off', async () => {
    const { service, repo, alerts } = make({}, false);
    await service.record('org', 'registration', 'first');
    expect(repo.exists).not.toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
    expect(alerts.funnelEvent).not.toHaveBeenCalled();
  });

  it('passes the internal class on, the alert service drops it', async () => {
    const { service, alerts } = make({
      acquisition: jest.fn(async () => ({ source: 'x', internalOrTest: true })),
    });
    await service.record('org', 'registration', 'first');
    expect(alerts.funnelEvent).toHaveBeenCalledWith(
      expect.objectContaining({ internalOrTest: true })
    );
  });

  it('keeps recording when the alert fails', async () => {
    const { service, repo, alerts } = make();
    alerts.funnelEvent.mockRejectedValue(new Error('email down'));
    await expect(
      service.record('org', 'registration', 'first')
    ).resolves.toBeUndefined();
    expect(repo.save).toHaveBeenCalled();
  });

  it('stores the network of the first connected channel', async () => {
    const { service, repo, alerts } = make();
    await service.channelConnected('org', 'int-1');
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'channel_connected', provider: 'linkedin' }),
      false
    );
    expect(alerts.funnelEvent).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'linkedin' })
    );
  });

  it('records a connect failure as a category of the attempt', async () => {
    const { service, repo } = make();
    await service.channelConnectFailed('org', 'instagram', 'cancelled', 'state-1');
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        key: measurementHash('org|channel_connect_failed|state-1'),
        kind: 'channel_connect_failed',
        provider: 'instagram',
        reason: 'cancelled',
      }),
      true
    );
  });

  it('records a publish failure once per post and error, with the short error in the alert only', async () => {
    const { service, repo, alerts } = make();
    await service.publishFailed('post-1', '{"message":"Rate limit exceeded"}');
    const saved = (repo.save.mock.calls as unknown as [Record<string, unknown>][])[0][0];
    expect(saved).toMatchObject({
      kind: 'publish_failed',
      organizationId: 'org',
      provider: 'x',
      key: measurementHash('org|publish_failed|post-1|Rate limit exceeded'),
      reference: measurementHash('post-1'),
    });
    expect(JSON.stringify(saved)).not.toContain('Rate limit');
    expect(alerts.funnelEvent).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'x', detail: 'Rate limit exceeded' })
    );

    repo.save.mockClear();
    repo.failedPost.mockResolvedValue(null);
    await service.publishFailed('gone', 'Error');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('records an ended plan with the reason it was given', async () => {
    const { service, repo } = make();
    await service.subscriptionEnded('org', 'trial_expired', 'sub_1', 'STANDARD');
    await service.subscriptionEnded('org', 'cancelled', 'sub_2', 'TEAM');
    expect(repo.save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ kind: 'subscription_ended', reason: 'trial_expired' }),
      true
    );
    expect(repo.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ kind: 'subscription_ended', reason: 'cancelled' }),
      true
    );
  });
});

describe('MeasurementService workflow failures', () => {
  it('records nothing for a duplicate run or a post deleted meanwhile', async () => {
    const { service, repo } = make();
    await service.publishFailed('post-1', 'Already posted');
    await service.publishFailed('post-1', 'No Post');
    expect(repo.failedPost).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('tells a reconnect, a channel turned off and a lapsed plan from a network error', async () => {
    const { service, repo } = make();
    await service.publishFailed('a', 'Refresh channel needed');
    await service.publishFailed('b', 'Channel disabled');
    await service.publishFailed(
      'c',
      'This post was not published because the organization has no active subscription.'
    );
    await service.publishFailed('d', '{"message":"Rate limited"}');
    const reasons = (repo.save.mock.calls as unknown as [{ reason: string }][]).map(
      ([data]) => data.reason
    );
    expect(reasons).toEqual([
      'refresh_needed',
      'channel_disabled',
      'no_subscription',
      'provider_error',
    ]);
  });
});

describe('shortError', () => {
  it('reads the message of a provider payload and cuts it short', () => {
    expect(shortError('{"error":{"message":"Token expired"}}')).toBe('Token expired');
    expect(shortError({ message: 'Bad request\nstack...' })).toBe('Bad request');
    expect(shortError('Too long. '.repeat(40))).toHaveLength(160);
    expect(shortError(undefined)).toBe('unknown error');
  });

  it('drops what looks like an email or a token', () => {
    expect(shortError('No access for jane@acme.test')).toBe('No access for [email]');
    expect(shortError(`Invalid token ${'a'.repeat(40)}`)).toBe('Invalid token [redacted]');
  });
});
