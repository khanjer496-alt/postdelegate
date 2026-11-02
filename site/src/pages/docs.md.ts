import type { APIRoute } from 'astro';
import { DOC_MARKDOWN, renderDocMarkdown } from '../data/docs-markdown';
// Markdown twin of the docs home, /docs.md.
export const GET: APIRoute = () => new Response(renderDocMarkdown(DOC_MARKDOWN.find((doc) => doc.href === '/docs')!), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
