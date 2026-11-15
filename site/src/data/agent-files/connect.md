| Way in | Address | Sign-in |
| --- | --- | --- |
| MCP, OAuth (preferred) | `{{mcp_oauth}}` | The client opens a PostDelegate page, the user signs in and clicks **Authorize**. No key to copy. |
| MCP, API key | `{{mcp_key}}` | Header `Authorization: Bearer YOUR_API_KEY` (a bare key also works here) |
| REST API (fallback) | `{{rest_base}}` | Header `Authorization: YOUR_API_KEY`, the bare key with **no** `Bearer ` |

- MCP uses the streamable HTTP transport. Prefer OAuth wherever the client supports it.
- The API key is in the app under **Settings > Agents / Dev**. It acts as the whole workspace, so keep it in the client's config or a secret store. Never ask the user to paste it into a chat, and never commit it.
- The REST API wants the bare key and rejects `Bearer `. `/mcp` documents `Bearer ` and also accepts the bare key. Sending `Bearer ` to REST is the most common cause of a `401`.
- The public API and MCP are included in every plan ({{plans}}).


## Results to reviewed drafts

Use resultsToReviewedDraftsTool for the workflow. Choose a bounded recent period (at most 90 days), explicit timezone and UTC dates. Cite actual permitted post IDs, metric names/values, periods and observation times. Qualify stale/weak samples. With no usable history, say so and propose labeled experiments; do not invent winners, causal growth or revenue.

Read integrationSchema, propose next week's channel-specific text/media/thread/schedule, then use postPreflightTool on that input. INVALID needs correction; UNKNOWN remains unresolved, including live credential readiness, media and unmaterialized short links. Preflight saves nothing and is not publication authority.

Use createPostForReviewTool and report real draft IDs/preview URLs plus IN_REVIEW receipts. If a draft was saved without review submission, use sendPostForReviewTool on that ID; never recreate it or substitute schedule-now. Human approval must match the revision. Analyst reads/checks only; Draft-only cannot edit/review queued content, cancel/resume or publish. Publisher still follows workspace approval/channel/daily-limit policy and never approves.

For cancellation prefer postUnscheduleTool over deletion. For recovery use postResumeTool only as returned: BLOCKED/OUTCOME_UNKNOWN means no retry, never delete/recreate to evade it. A missing receipt, ERROR, timeout or worker restart does not prove unpublished. Confirmed published segments stay intact. Unsupported provider reconciliation remains blocked. Credential revoke/expiry does not implicitly unschedule accepted approved workspace jobs. Generation of media is optional; never claim reviewed/queued means live.
