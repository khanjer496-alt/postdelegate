| Way in | Address | Sign-in |
| --- | --- | --- |
| MCP, OAuth (preferred) | `{{mcp_oauth}}` | The client opens a PostDelegate page, the user signs in and clicks **Authorize**. No key to copy. |
| MCP, API key | `{{mcp_key}}` | Header `Authorization: Bearer YOUR_API_KEY` (a bare key also works here) |
| REST API (fallback) | `{{rest_base}}` | Header `Authorization: YOUR_API_KEY`, the bare key with **no** `Bearer ` |

- MCP uses the streamable HTTP transport. Prefer OAuth wherever the client supports it.
- The API key is in the app under **Settings > Agents / Dev**. It acts as the whole workspace, so keep it in the client's config or a secret store. Never ask the user to paste it into a chat, and never commit it.
- The REST API wants the bare key and rejects `Bearer `. `/mcp` documents `Bearer ` and also accepts the bare key. Sending `Bearer ` to REST is the most common cause of a `401`.
- The public API and MCP are included in every plan ({{plans}}).
