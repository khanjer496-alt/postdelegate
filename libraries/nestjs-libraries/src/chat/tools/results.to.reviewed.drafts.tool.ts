import { Injectable } from '@nestjs/common';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AgentToolInterface } from '../agent.tool.interface';
import { checkAuth } from '../auth.context';

export const RESULTS_TO_REVIEWED_DRAFTS = [
  'Choose a bounded recent period (at most 90 days), explicit timezone and UTC start/end. List only permitted channels with integrationList. Record the observation time and source period for every metric.',
  'Use analyticsMetricsTool, analyticsTopPostsTool, bestTimeToPostTool and channelAnalyticsTool only where permitted. Cite real post IDs, channel IDs, metric names/values and source dates. Never invent absent metrics. Observed engagement does not prove causal growth or revenue.',
  'Qualify freshness, missing data and weak samples. With sparse history label recommendations tentative. With no usable history say so and propose explicitly labeled experiments, without invented winners or baseline numbers.',
  'Propose next week channel-specific drafts, audience, hypothesis and measurement. Read integrationSchema for each channel. Reuse ready media; generation is optional. Confirm the desired text/media/channel/thread/schedule revision.',
  'Run postPreflightTool on the exact proposed input. Correct INVALID checks; explain unresolved UNKNOWN checks including credentials, media and short links. Preflight is a snapshot, not publication authority.',
  'Use createPostForReviewTool, never schedule-now as a substitute. Record returned draft IDs, preview URLs and IN_REVIEW receipts. If saved drafts were not submitted, use sendPostForReviewTool on those IDs; never recreate them. Missing IN_REVIEW receipt means review submission is unconfirmed.',
  'Return evidence citations, proposed experiments, draft IDs and actual review receipts. Human approval is required before these review drafts publish. Do not create a recurring automation or claim queued/reviewed means publicly posted.',
];

@Injectable()
export class ResultsToReviewedDraftsTool implements AgentToolInterface {
  name = 'resultsToReviewedDraftsTool';
  optionalOnSelfHosted = true;
  run() {
    return createTool({
      id: this.name,
      description: 'Get the evidence-to-reviewed-drafts workflow: bounded analytics, sparse/missing-data qualifications, channel-specific next-week experiments, no-write preflight, then human-review draft IDs and IN_REVIEW receipts. Guidance only; does not read metrics, save or publish.',
      mcp: { annotations: { title: 'Results to Reviewed Drafts', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
      inputSchema: z.object({}), outputSchema: z.object({ output: z.array(z.string()) }),
      execute: async (input, context) => { checkAuth(input, context); return { output: RESULTS_TO_REVIEWED_DRAFTS }; },
    });
  }
}
