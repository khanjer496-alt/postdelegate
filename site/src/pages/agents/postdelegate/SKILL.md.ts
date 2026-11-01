import type { APIRoute } from 'astro';
import { SKILL_MD } from '../../../data/agent-files';
export const GET: APIRoute = () => new Response(SKILL_MD, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
