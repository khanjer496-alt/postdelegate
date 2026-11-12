jest.mock('@gitroom/frontend/components/layout/user.context', () => ({
  useUser: jest.fn(),
}));
jest.mock('@gitroom/helpers/utils/custom.fetch', () => ({
  useFetch: jest.fn(),
}));
jest.mock('@gitroom/react/helpers/variable.context', () => ({
  useVariables: jest.fn(),
}));
jest.mock('@gitroom/react/toaster/toaster', () => ({ useToaster: jest.fn() }));
jest.mock('@gitroom/react/translation/get.transation.service.client', () => ({
  useT: jest.fn(),
}));
jest.mock('@gitroom/frontend/components/layout/new-modal', () => ({
  useDecisionModal: jest.fn(),
}));
jest.mock('@gitroom/frontend/components/public-api/mcp.client.icons', () => ({
  McpClientIcon: () => null,
}));
import {
  getMcpConfig,
  getMcpOauthUrl,
  mcpClients,
  remoteMcpClients,
} from './public.component';
const clients = [...Object.keys(remoteMcpClients), ...mcpClients] as Parameters<
  typeof getMcpConfig
>[0][];
const key = 'EXAMPLE-API-KEY-DO-NOT-USE';
const endpoint = 'https://app.postdelegate.test/api/mcp';
it('uses the public API-prefix MCP resource for OAuth, with no double slash', () => {
  expect(getMcpOauthUrl('https://app.postdelegate.test/api')).toBe(endpoint);
  expect(getMcpOauthUrl('https://app.postdelegate.test/api/')).toBe(endpoint);
});
it.each(clients)(
  '%s defaults to a credential-free OAuth configuration',
  (client) => {
    const { config } = getMcpConfig(
      client,
      'oauth',
      'https://app.postdelegate.test/api',
      key
    );
    expect(config).toContain(endpoint);
    expect(config).not.toContain(key);
    expect(config).not.toContain('/mcp-oauth-dynamic');
  }
);
it.each(clients)(
  '%s never generates an API key in a URL, including fallback mode',
  (client) => {
    const { config } = getMcpConfig(
      client,
      'apikey',
      'https://app.postdelegate.test/api/',
      key
    );
    const urls = config.match(/https?:\/\/[^\s"'\\]+/g) || [];
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).not.toContain(key);
      expect(url).toBe(endpoint);
    }
    if (['Claude', 'ChatGPT', 'NanoClaw'].includes(client))
      expect(config).not.toContain(key);
    else expect(config).toContain(`Bearer ${key}`);
  }
);
