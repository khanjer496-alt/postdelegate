import { getContext } from './async.storage';

// Default deny for unknown tools. This list is server-owned, not client annotations.
const readTools = new Set([
  'postPreflightTool', 'resultsToReviewedDraftsTool',
  'integrationList', 'integrationSchema', 'groupList', 'postsListTool',
  'mediaListTool', 'mediaStatusTool', 'videoStatusTool', 'generateVideoOptions',
  'videoFunctionTool', 'clippingStatusTool', 'studioTemplatesTool',
  'studioRenderStatusTool', 'uploadWidgetStatusTool',
  // analytics only read what the networks report
  'analyticsMetricsTool', 'analyticsTopPostsTool', 'bestTimeToPostTool',
  'channelAnalyticsTool',
]);
export const requiredMcpScope = (name: string) =>
  readTools.has(name) ? 'mcp:read' : 'mcp:write';

export function scopeMcpTools<T extends Record<string, any>>(tools: T): T {
  return Object.fromEntries(Object.entries(tools).map(([name, tool]) => [name, {
    ...tool,
    execute: async (...args: any[]) => {
      const required = requiredMcpScope(name);
      const scopes = getContext()?.scopes || [];
      if (name === 'ask_postdelegate' && !scopes.includes('mcp:read')) {
        throw new Error('insufficient_scope: mcp:read required');
      }
      if (!scopes.includes(required)) {
        throw new Error(`insufficient_scope: ${required} required`);
      }
      return tool.execute(...args);
    },
  }])) as T;
}
