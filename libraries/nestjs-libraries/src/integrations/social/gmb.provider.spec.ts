import 'reflect-metadata';

// Only the Google OAuth client is replaced: its transporter records the
// revocation request and answers like Google does.
const request = jest.fn();
jest.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: jest.fn(() => ({ transporter: { request } })) },
    oauth2: jest.fn(),
  },
}));

import { GmbProvider } from '@gitroom/nestjs-libraries/integrations/social/gmb.provider';

describe('GmbProvider revokeAuthorization', () => {
  afterEach(() => {
    request.mockReset();
  });

  const revoke = (credentials: { accessToken: string; refreshToken?: string | null }) =>
    new GmbProvider().revokeAuthorization({ ...credentials, internalId: 'accounts/1/locations/2' });

  it('revokes the refresh token at Google with a form body', async () => {
    request.mockResolvedValueOnce({ status: 200 });

    expect(await revoke({ accessToken: 'at', refreshToken: 'rt' })).toEqual({
      status: 'revoked',
    });
    expect(request).toHaveBeenCalledTimes(1);
    const [options] = request.mock.calls[0];
    // the token never goes in the URL
    expect(options).toMatchObject({
      url: 'https://oauth2.googleapis.com/revoke',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: 'token=rt',
      retry: false,
    });
  });

  it('falls back to the access token when there is no refresh token', async () => {
    request.mockResolvedValueOnce({ status: 200 });

    await revoke({ accessToken: 'at', refreshToken: null });
    expect(request.mock.calls[0][0].data).toBe('token=at');
  });

  it('treats a token Google no longer knows as revoked', async () => {
    request.mockRejectedValueOnce({
      response: { status: 400, data: { error: 'invalid_token' } },
    });

    expect(await revoke({ accessToken: 'at', refreshToken: 'rt' })).toEqual({
      status: 'revoked',
    });
  });

  it('reports unknown when Google refuses or cannot be reached', async () => {
    request.mockRejectedValueOnce({ response: { status: 503, data: {} } });
    expect(await revoke({ accessToken: 'at', refreshToken: 'rt' })).toEqual({
      status: 'unknown',
    });

    request.mockRejectedValueOnce(new Error('down'));
    expect(await revoke({ accessToken: 'at', refreshToken: 'rt' })).toEqual({
      status: 'unknown',
    });
  });

  it('reports unknown without calling Google when no token is stored', async () => {
    expect(await revoke({ accessToken: '', refreshToken: null })).toEqual({
      status: 'unknown',
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('marks its grant as covering the whole Google account', () => {
    expect(new GmbProvider().revokesAccountGrant).toBe(true);
  });
});
