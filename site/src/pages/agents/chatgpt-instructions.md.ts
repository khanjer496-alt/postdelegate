import type { APIRoute } from 'astro';
import { CHATGPT_INSTRUCTIONS_MD } from '../../data/agent-files';
export const GET: APIRoute = () => new Response(CHATGPT_INSTRUCTIONS_MD, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
