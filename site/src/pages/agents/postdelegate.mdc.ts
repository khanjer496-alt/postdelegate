import type { APIRoute } from 'astro';
import { CURSOR_RULE_MDC } from '../../data/agent-files';
export const GET: APIRoute = () => new Response(CURSOR_RULE_MDC, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
