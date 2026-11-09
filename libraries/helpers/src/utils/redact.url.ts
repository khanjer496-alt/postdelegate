// Telemetry never needs a URL's credentials, query or fragment. This applies to
// nested error context, navigation spans, logs and Replay's custom events.
export const scrubTelemetry = <T>(value: T): T => {
  const seen = new WeakSet<object>();
  const walk = (item: any, depth: number, parent = ''): any => {
    if (depth > 30) return '[Filtered]';
    if (typeof item === 'string') {
      const cleanUrl = (text: string) => {
        try {
          const parsed = new URL(text, 'https://redacted.invalid');
          return /^https?:\/\//i.test(text)
            ? parsed.origin +
                parsed.pathname.replace(
                  /(\/(?:mcp|sse|message)\/)[^/]+/gi,
                  '$1[Filtered]'
                )
            : parsed.pathname.replace(
                /(\/(?:mcp|sse|message)\/)[^/]+/gi,
                '$1[Filtered]'
              );
        } catch {
          return '[Filtered URL]';
        }
      };
      if (/^(https?:\/\/|\/)/i.test(item)) return cleanUrl(item);
      return item
        .replace(/https?:\/\/[^\s<>"']+/gi, cleanUrl)
        .replace(/\/[a-z0-9_./%-]+\?[^\s<>"']+/gi, cleanUrl)
        .replace(
          /(?:\/[a-z0-9._%-]+)*\/(?:mcp|sse|message)\/[^\s/?#<>"']+/gi,
          cleanUrl
        );
    }
    if (!item || typeof item !== 'object') return item;
    if (seen.has(item)) return '[Circular]';
    seen.add(item);
    if (Array.isArray(item)) return item.map((v) => walk(v, depth + 1, parent));
    return Object.fromEntries(
      Object.entries(item).map(([key, val]) => {
        const name = key.replace(/[-_]/g, '').toLowerCase();
        const segment = name.split('.').pop();
        const sensitive =
          /password|secret|token|cookie|credential|authorization|apikey|privatekey/.test(
            name
          ) ||
          [
            'code',
            'authcode',
            'querystring',
            'query',
            'fragment',
            'search',
            'requestbody',
          ].includes(segment || '') ||
          (['request', 'response'].includes(parent) && name === 'body') ||
          (parent === 'request' && name === 'data');
        return [key, sensitive ? '[Filtered]' : walk(val, depth + 1, name)];
      })
    );
  };
  return walk(value, 0);
};

// These are application handoff pages, not marketing destinations. Third-party
// page trackers must not load here, including when analytics consent is present.
export const isSensitiveTelemetryPath = (pathname: string | null) =>
  /^\/(?:integrations\/social(?:\/|$)|auth(?:\/|$))/i.test(pathname || '') ||
  /\/(?:mcp|sse|message)\/[^/]+/i.test(pathname || '');
