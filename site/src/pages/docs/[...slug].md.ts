import type { APIRoute, GetStaticPaths } from 'astro';
import { DOC_MARKDOWN, renderDocMarkdown, type DocMarkdown } from '../../data/docs-markdown';
// Markdown twin of every docs page: /docs/<path>.md.
export const getStaticPaths = (() => DOC_MARKDOWN.filter((doc) => doc.href !== '/docs')
  .map((doc) => ({ params: { slug: doc.href.replace(/^\/docs\//, '') }, props: { doc } }))) satisfies GetStaticPaths;
export const GET: APIRoute<{ doc: DocMarkdown }> = ({ props }) => new Response(renderDocMarkdown(props.doc), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
