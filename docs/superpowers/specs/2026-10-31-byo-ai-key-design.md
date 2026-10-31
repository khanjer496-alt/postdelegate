# Bring-your-own AI key — design

Date: 2026-10-31 · Branch: `pd/byo-ai-key` (from `origin/main` 244aa847)

## Why

PostDelegate's owner does not pay for AI, ever. Stock Postiz calls OpenAI with an operator key
(`process.env.OPENAI_API_KEY`). Today AI is switched off everywhere: every tier has `ai: false`, and the
server has no key. We want customers to get the AI features back by connecting their own OpenAI API key.
OpenAI's "Sign in with ChatGPT" plan sharing would be friendlier, but it is invite-only for paid, hosted apps,
so a pasted API key is the only route available today (research: side-session notes, `chatgpt-signin-research.md`).

## Goals

- Each workspace (Organization) can store one OpenAI API key, encrypted. Every AI feature uses it:
  post writing and improving (`OpenaiService`), the Agent chat (Mastra), the CopilotKit chat, the post
  generator (`AgentGraphService`), public-API "new post" (`AgentGraphInsertService`), autopost,
  image generation, and clip picking.
- **No platform-paid AI is possible.** No AI call path may read `process.env.OPENAI_API_KEY`, and none may
  fall back to it. With no workspace key, the call fails with a clear "Add your OpenAI key in Settings → AI"
  error (HTTP 400 for requests; background jobs skip the AI step without retrying).
- AI is on for a workspace exactly when it has a key, whatever its plan. "Every plan gets AI with its own key"
  is the owner's decision.
- Only workspace admins (ADMIN/SUPERADMIN) can add, replace or remove the key. Nobody ever gets the full key
  back: the API returns only a mask such as `sk-…a9F2`.
- Saving a key first checks it against OpenAI with one cheap call (`client.models.list()`, which is free).
  A key that fails the check is not stored.

## Non-goals

- Anthropic/Claude keys. The schema has a `provider` column so Claude can be added later without a migration,
  but this PR ships OpenAI only. Our code uses OpenAI-only features (zod `response_format`, image generation,
  the langchain/Mastra/CopilotKit OpenAI adapters), so Claude needs its own provider-generic work.
- Sign in with ChatGPT plan sharing (needs OpenAI approval first).
- AI video (fal.ai, ElevenLabs, HeyGen): it stays env-gated and off. Its OpenAI text steps must still use the
  workspace key, or skip, never the env key.
- Usage metering or limits. The customer pays OpenAI directly.

## Anti-goals (a failure even if it "works")

- Any code path where a PostDelegate-owned key could be billed.
- The decrypted key reaching the browser, logs, Mastra memory or storage, Temporal payloads, or error messages.
- Breaking existing users. Nobody uses AI today, so the only risk is breaking unrelated flows, such as making
  Organization payloads larger or changing activity params.

## Constraints (repo CLAUDE.md)

- DTO >> Controller >> Service >> Repository. Logic lives in `libraries/nestjs-libraries`. Prisma only. pnpm only.
- Never edit existing Temporal workflow files or activity parameters. The changes here sit inside services that
  activities already call (`clipping.service.pickClips(clippingId)`, `autopost.service.startAutopost(id)`), so
  activity signatures stay the same.
- Frontend: SWR with `useFetch`, one hook per SWR call, native components, Tailwind tokens (no `--color-custom*`).
- The schema is applied with `prisma db push`. The change must be additive only.

## Decisions

### Storage
A new Prisma model, kept separate from `Organization` so the encrypted key never ends up in the many
Organization payloads (for example `requestContext 'organization'` JSON and `/user/self`):

```prisma
model AiCredential {
  id             String       @id @default(uuid())
  organizationId String       @unique
  provider       String       @default("openai")
  apiKey         String       // AuthService.fixedEncryption, same as ThirdParty.apiKey
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  organization   Organization @relation(fields: [organizationId], references: [id])
}
```
Add `aiCredential AiCredential?` on `Organization`. Removing the key hard-deletes the row, so a removed secret
doesn't linger (my call). Encryption uses the existing `AuthService.fixedEncryption/fixedDecryption`, the house
pattern for third-party API keys. The mask is computed on read by decrypting and keeping the last 4 characters.

### Backend layers (follow `third-party` / `webhooks` as the model)
- `libraries/nestjs-libraries/src/database/prisma/ai-credentials/ai.credential.repository.ts` (Prisma).
- `.../ai-credentials/ai.credential.service.ts`, the single gateway for AI credentials:
  - `getCredential(orgId)` → `{ provider, maskedKey } | null`
  - `saveCredential(orgId, dto)`: validates with OpenAI, then upserts. Invalid key → `BadRequestException`.
  - `deleteCredential(orgId)`
  - `hasCredential(orgId): Promise<boolean>`
  - `getOpenAiKey(orgId): Promise<string>`: throws `BadRequestException('Add your OpenAI key in Settings → AI')`
    when there is none. Every AI call site gets its key here and nowhere else.
  - `getOpenAiClient(orgId): Promise<OpenAI>` builds `new OpenAI({ apiKey })`.
  - Register it in `database.module.ts` like the other prisma services.
- DTO: `libraries/nestjs-libraries/src/dtos/ai-credentials/ai.credential.dto.ts` with `provider` (`IsIn(['openai'])`)
  and `apiKey` (`IsString`, `MinLength(20)`, `MaxLength(300)`).
- Controller: `apps/backend/src/api/routes/ai.credentials.controller.ts`, `@Controller('/ai-credentials')`,
  registered in `api.module.ts`:
  - `GET /` → masked credential or `null` (any member; the UI only shows it to admins)
  - `POST /` and `DELETE /` → `@CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])`, the same way
    other admin-only routes are guarded. Check an existing admin-guarded route and copy it.

### Gating
- `isAiAvailable` in `pricing.ts` no longer reads the env. The gate is "this workspace has a credential".
  Change it to `isAiAvailable(hasCredential: boolean)`, or remove it and call
  `AiCredentialService.hasCredential` directly. Pick whichever keeps call sites tidy and update `pricing.spec.ts`.
- `PermissionsService.check`: `Sections.AI` is allowed when `hasCredential(orgId)`, in both the
  billing-off and billing-on branches. Inject `AiCredentialService`. Update `permissions.service.ai.spec.ts`.
- `/user/self` → `aiAvailable: await hasCredential(organization.id)`.
- Leave the tier `ai` flags in `pricing.ts` as they are. They drive marketing copy, not the gate.
- Image credits: `image_generation_count` is 0 on every tier, so today the credit gate (`checkCredits` /
  `useCredit`) would block image generation even with a key. Credits only existed to cap operator cost, so
  images made with the workspace's own key must not be blocked by them. Do it as narrowly as possible:
  `MediaService.generateImage` and `generate.image.tool.ts` (and `media.controller` if it checks too) skip the
  credit gate now that image generation always uses the workspace key. Don't touch other credit types (videos).

### Call sites (all switch to the workspace key; module-level clients are deleted)
| Where | Change |
|---|---|
| `openai/openai.service.ts` | Delete the module-level `openai` client. Every method takes `orgId: string` first and uses `await aiCredentialService.getOpenAiClient(orgId)`. Callers pass the org id. |
| `posts.service.separatePosts` / `posts.controller` | Pass `org.id`. |
| `media.service.generateImage` | Pass `org.id` to `generatePromptForPicture` / `generateImage`. |
| `clipping.service.pickClips(clippingId)` | Use the clipping's `organizationId`. A missing key makes the clipping fail cleanly, without retry loops: follow how the service already marks a clipping as failed. |
| `upload.factory.clippingEnabled` | Drop the `OPENAI_API_KEY` condition (the key is now per workspace). Keep the other env checks. |
| `videos/images-slides/images.slides.ts` | Disabled (see decision 6). |
| `3rdparties/heygen.provider.generateVoice` | Return `data.text` unchanged (no AI rewrite). |
| `agent/agent.graph.service.ts` | Build `ChatOpenAI` per run from the org key (`start(orgId, …)` already has it). Keep `apps/commands/src/tasks/agent.run.ts` compiling. |
| `agent/agent.graph.insert.service.ts` | Deleted (see decision 1). |
| `autopost/autopost.service.ts` | Build `ChatOpenAI` / `DallEAPIWrapper` per run from `body.organizationId`. If the workspace has no key, skip that run's AI steps and don't publish an AI-less post; return the same way an empty feed does. No retries. |
| `chat/load.tools.service.ts` | Mastra `model` becomes a dynamic function: read the org id from `requestContext.get('organization')` (JSON, already set by the copilot controller), then `createOpenAI({ apiKey: await getOpenAiKey(orgId) })('gpt-5.2')`. Never put the key itself into `requestContext`. See decision 2 for the MCP fallback. |
| `copilot.controller.ts` | Remove the env checks (the `Sections.AI` policy already requires a credential). Pass `openai: await getOpenAiClient(org.id)` to every `OpenAIAdapter`. `/chat` gains `@GetOrgFromRequest()`. |
| Any chat tool (`chat/tools/*`) or other file still calling OpenAI | Same rule: workspace key only. Finish with `git grep -n "OPENAI_API_KEY"`: no runtime use may remain (only docs, the env example, or a comment saying it's unused). |

### Frontend
- New tab in `components/layout/settings.component.tsx`: `{ tab: 'ai', label: t('ai_settings', 'AI') }`,
  shown when `user?.role !== 'USER'`, placed after Global Settings.
- `components/settings/ai.settings.component.tsx`, styled like the webhooks/public-API settings
  (native inputs and buttons from `components/ui`):
  - SWR hook `useAiCredential()` (its own hook, `useFetch`, key `ai-credentials`).
  - No key: a short explainer ("PostDelegate's AI writing, Agent and images run on your own OpenAI account.
    You pay OpenAI directly for what you use. A ChatGPT Plus subscription doesn't include API usage."), a link
    to https://platform.openai.com/api-keys, a password input and Save. Show the server's error on failure.
  - Key saved: masked key, "Replace" and "Remove" (Remove asks for confirmation with the existing
    `deleteDialog`).
  - After save or remove: `mutate()` the hook **and** refresh the user context (`/user/self`), so
    `aiAvailable` flips and the AI buttons appear or disappear without a reload. Check how other components
    refresh the user.
- Everything else keeps its existing `aiAvailable` gating, so features appear once a key exists.
- Strings go through `t('key', 'Default')`. Add keys to the translation files the same way neighbouring
  components do.

### Tests
- `ai.credential.service.spec.ts`: save validates (mock the OpenAI `models.list`), stores encrypted (not
  plaintext), returns only the mask; `getOpenAiKey` throws without a credential; delete removes it.
- Update `pricing.spec.ts` and `permissions.service.ai.spec.ts` to the new gate. Add a regression assertion:
  setting `process.env.OPENAI_API_KEY` alone does **not** make AI available.
- Run backend/libs jest for the touched specs, `pnpm` lint from the root, and type-check/build the backend,
  orchestrator and frontend.

## Decisions after the builder check (all my calls; owner delegated them)
1. **`POST /public/agent`** is an operator-only endpoint gated by `AGENT_API_KEY`, with no workspace. It feeds
   Postiz's global "popular posts" table using operator-paid AI. **Remove it**: delete the route from
   `public.controller.ts` (and its spec mock), and delete `AgentGraphInsertService` and its provider registration.
   No replacement.
2. **MCP `ask_postdelegate`** (`start.mcp.ts` registers `agents: { postdelegate: agent }`) runs the agent model. The
   dynamic Mastra `model` function resolves the org from `requestContext.get('organization')`, then falls back
   to the async-storage `getAuth()` org (`chat/async.storage.ts`), then throws the "Add your OpenAI key" error.
   Memory `generateTitle` uses the same dynamic model. That's fine.
3. **Agent page:** shown in the menu for every workspace (owner's call, 31 Oct 2026). Without a key it shows a
   "Connect your OpenAI key to start" empty state: admins get a button to Settings → AI, and members are told to ask
   their workspace admin. With a key it works as before. Every other AI button stays hidden until a key exists.
4. **Plan feature flags** (`image_generator`, `autoPost`, `clipping_minutes`, `generate_videos`) stay as they
   are. "AI on for every plan" means only the `Sections.AI` / `aiAvailable` gate. Plan features keep their own
   flags.
5. **Clipping** also checks `hasCredential` at creation time, before any RunPod/Deepgram work, wherever the
   clipping row is created (service layer), with the same friendly error. `pickClips` still uses the workspace
   key. Credits for clipping stay unchanged.
6. **`image-text-slides` video** (`images.slides.ts`) depends on platform-paid fal.ai and ElevenLabs, so it is
   off in PostDelegate: its `available()` returns `false`, with a one-line comment. Its OpenAI step can't reach
   an org without changing `VideoAbstract`, so remove the `generateSlidesFromText` call (make `process` throw
   `BadRequestException('This video type is not available')` first), and delete `generateSlidesFromText` and
   `generateVoiceFromText` from `OpenaiService` if nothing else uses them. HeyGen `generateVoice` returns
   `data.text` unchanged.
7. **Autopost** checks for the key only when the run needs AI (`generateContent` or `addPicture`). Runs that
   need no AI behave exactly as today.
8. Key validation uses `models.list()`. On failure the error reads "OpenAI rejected this key. Check it's an
   active API key with access to models."

## Left to the builder
Exact file names inside the folders above; whether `isAiAvailable` survives as a helper; the copy beyond the
lines above; how the clipping/autopost "no key" exit plugs into their existing failure paths. In every case,
copy the nearest existing pattern.

## Rollout
Additive table via `prisma db push` on deploy. Existing users see a new "AI" settings tab and nothing else
changes until they add a key. **No production deploy without asking the owner.**
