import type { APIRoute } from 'astro';
import { AGENTS_MD } from '../../data/agent-files';
export const GET: APIRoute = () => new Response(AGENTS_MD, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
