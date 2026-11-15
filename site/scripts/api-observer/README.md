# PR217 whole API-observation v3 — static review only, NOT published/run

Replaces v2 candidate after Reviewer d321ca92 / Security89b3a92c. Shipping7c84/temp1f29 remain untouched. This local candidate includes exact proposed workflow.yml for SAME temporary branch; no new PR, branch or implementation queue. Generic/no-cause observation still STOP, no logs/messages/signature expansion or speculative release fix.

## Fixed completion boundary (F1/M1)

Executor's provisional report is captured ONLY in entry memory via injected persist callback. It is not a readiness file. After observation+owned teardown, entry aborts the public ASSETS generator's owned watcher signal, checks raw worker and every source/payload control against original hashes, then exclusively/atomically publishes a complete terminal report. Failed postflight publishes exitCode1/postflightVerifiedfalse, or missing terminal on unexpected failure. Source/payload control drift cannot pass by changing both copies. Source code and worker never repaired.

publishTerminal writes a private0600 wx temporary file, hard-links the closed file exclusively to the final name (atomic complete visibility, no overwrite), then removes only its own temporary. There are no public partial/provisional files. The child's actual process outcome remains authoritative, independent of file contents.

Parent never polls file existence as readiness. Its probe always returns no readiness and performs NO HTTP. It waits for natural child exit or the35s deadline before reviewed group cleanup. Only AFTER that lifecycle completes does it read a bounded regular nonsymlink terminal file. Success requires complete terminal/schema/postflight, observation success/cleanup/no errors/fault, observed natural child exit0 BEFORE cleanup/no signal/spawn/probe failures, final exit0, confirmed group absence and no cleanup errors. Report then exit1, report then hang/forced kill, partial/premature report or failed final hash are non-PASS. Process polling is labeled natural-child-exit-only-no-HTTP; false HTTP200/loopback fields removed. Controlled cleanup does not turn a non-natural/failed exit into success.

ASSETS cleanup change is explicit: input passes the public optional AbortSignal to unstable_generateASSETSBinding; entry aborts it only AFTER observation, in finally. This closes diagnostic-owned file watchers so natural completion is possible. It does not alter requests/controllers before completion. Unlike stock CLI's process-level cleanup, this API diagnostic closes its owned watcher through the supported public signal. Both this declared lifecycle difference and final parent/workflow need renewed review. A hanging/late task still fails the natural-exit requirement; Promise.race does not cancel in-flight work.

## Strict retained preflight (F2)

strictPreflight requires source equality, workerUnchanged===true (no truthiness), checkRawWorkerEquivalent.status===succeeded AND metadataAnalysis.status===succeeded, plus exact worker hash. Missing/failed/timed-out metadata and non-boolean truthy workerUnchanged refuse BEFORE startup. Source/control bytes checked before and after. Existing outdir/index-only/syntax/copy guard retained; no bundling/sandbox/policy relaxation.

## Full mapping and privacy carried forward

Pinned4.162 public DevEnv/ASSETS API; default controllers, normal route wrapper/alias semantics, date2026-09-08/[], source-derived Nodev2, undefined remote/inspector/persist, normal origin/default resolver. CF_PAGES defaults require verified no-config/no-git/cache fixture. Registry uses declared fresh stage/api-home+XDG; inherited overrides refuse without private reads rather than inventing a new path. Logger adapter's accepted output-only limitation remains explicit. Internal ASSETS logging is unchanged but child stdout/stderr discarded at spawn, not collected/exported. Public vendor validator (bundled devDependency, not private module) source/provenance/licenses retained; rejected-route exception/telemetry wrapper differs and stops before startup. ContainerID reproduces pinned randomUUID().slice(0,8). Auth reached => AUTH_NOT_ALLOWED/non-PASS without account action.

Observe only fixed event/source/reason/code classes, own-data causes max3/cycle safe, bounded records/counters. accessor flag means CAUSE accessor; code accessor becomes unavailable without invocation. error/config/proxy-ready rejection is fatal; runtimeError is counted, not independently fatal. proxyReady and reloadComplete are separate prerequisites; no proxy/URL/event payload access. No serialiseError, arbitrary name/message/stack/data/config/bundle/headers/options output.

## Exact proposed run contract — permission not implied

workflow.yml is only a review file: five-minute contents-read/no-secret job on SAME test/site-preview-startup-v1 push. Same pinned isolated CLI/raw compilation/typed preflight. One API observation REPLACES earlier CLI/minimal controls; those do not execute again. Parent outer75s, child35s, API25s observation+5s teardown, reviewed process-group1s TERM/KILL waits. Permission/unknown cleanup never escalated. External cancellation/job teardown must own group containment; finally is not an unconditional cancellation guarantee. No local native/CLI/Astro/OG/full build/install, source/default functions/controls change or deployment.

Upload only final named diagnostic JSONs, never private HOME/registry, wrapper/maps, public payload, logs or source runtime values. Existing stage diagnostic glob includes worker-build/worker-format plus API terminal/parent, all structured. No real site acceptance, source-bound release artifact, M5/customer/provider or build195/Wafra clearance follows. Whole exact candidate code/workflow review and existing CEO one-probe scope still required before any branch publication/event; no current runtime authority claimed.

## Actual local validation

PASS test-terminal.mjs: clean natural0 vs success report+exit1, report+hang/kill, postflight failure, partial/premature file, late error, spawn/probe failures, unknown/denied group cleanup, controlled termination; strict missing/failed/timed-out metadata+nonboolean guard; atomic exclusive publication/no-overwrite with tiny owned temporary files (removed).
PASS test-executor.mjs: config rejection/early+late error/ready rejection/split readiness/deadline/in-flight config/teardown rejection+timeout/observer fault/output failure.
PASS test-input.mjs: Nodev2/defaults/ASSETS/default bindings/ID shape/auth refusal.
PASS test-observe.mjs (retained): getter/cycle/depth/proxy-secret exclusion/registry/logger no-coercion.
Node syntax entry/parent/terminal; YAML/bash parse/read-only5min contract PASS. These are fake/pure/syntax checks only. No real child/native/API/esbuild/CLI/build/account/provider run or branch/workflow write. Only NEW local v3 packet + tiny removed fake temp files.
