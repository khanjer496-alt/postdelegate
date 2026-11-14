# Checked public site artifacts

`site-check-v1.yml` builds the standalone site's frozen lockfile, runs the full
`pnpm build` (OG generation included), compiles existing Functions with Wrangler
4.162.0, and checks a disposable loopback Pages preview. It has no deployment,
secrets, runtime bindings, production requests, IndexNow ping, or signup submission.
The preview never executes page scripts. The current all-HTML crawler middleware
is retained; without `PULSE_CRAWL_KEY` its outbound crawler branch is disabled.
`_routes.json`, `_headers`, and `_redirects` must equal source bytes; generated
defaults fail the job rather than being patched. Full hosted execution is a gate,
not something that synthetic verifier tests establish.

The successful artifact contains `public-payload.tar.gz`, `manifest.json`,
`acceptance.json`, and observed tool version text. The manifest binds the actual
checkout SHA, canonical repository, workflow/run/attempt, configured and observed
versions, site lock digest, each regular public file digest, and archive digest.
The archive is deterministic (sorted entries, fixed permissions/timestamps/gzip
metadata) and contains no source Functions directory. GitHub's immutable artifact
ID/digest is external provenance: it cannot be embedded before upload in its own
manifest. Failed checks never upload a release artifact. Page count is measured
from actual generated HTML and recorded in acceptance evidence.

## Release Engineer gates (no ready uploader supplied)

1. Obtain Reviewer plus specialist/QA approval and CEO go for the exact final
   source. Merge through the normal reviewed process. Require a successful,
   completed **canonical repository main** workflow run whose GitHub API `head_sha`
   equals the approved merged SHA. PR synthetic merge/head artifacts are review
   evidence only, never production provenance. Dispatch the workflow on main if
   an exact main build is needed. If main moved, reassess all intervening site
   changes and approvals; do not silently substitute a newer main.
2. Verify GitHub API run identity, event/ref, workflow path, run attempt, conclusion,
   artifact ID/name, expiry, and `sha256:` artifact digest against the downloaded
   GitHub artifact ZIP bytes. Authenticate metadata with the normal GitHub account;
   no token belongs in the payload. Reject ZIP absolute/traversal paths, symlinks,
   duplicate or unexpected members before extraction. Permit only the six expected
   files listed above (three version text files make six total). Verify the outer
   artifact's digest independently of the inner public archive digest.
3. Read the downloaded manifest and acceptance record. Require repository
   `khanjer496-alt/postdelegate`, source SHA, workflow/run/attempt, event/ref and
   `status: passed` to match the API and approved source. Compare site lock digest
   and exact source `_routes.json`, `_headers`, `_redirects` to the approved clean
   main checkout. Review configured/observed tool versions and the complete public
   file list. Artifact metadata alone and deployment commit labels do not prove
   these equalities. Use the verifier from that **approved source**, not a script
   downloaded from an artifact, to check every archive member/hash and extract:

   ```sh
   python3 site/scripts/accept-public-payload.py --extract /absolute/verified-evidence \
     --destination /absolute/new-disposable-payload --approved-sha <approved-merged-sha>
   ```

   The destination must not exist. This validates inner archive hash, safe regular
   paths, exact membership and every file digest before writing; it never uses
   `extractall`. Compare extracted control-file bytes with approved source again.
   No local regeneration, editing, worker compilation or built-output patching.
4. Capture current live deployment ID, source marker, successful state, custom
   domain, Functions status and the immediate prior rollback target. Keep that
   evidence with the release record. Have pinned Wrangler 4.162.0 already available.
   The existing Mac resource admission/serialization guard still applies; a held
   reserve blocks upload too. Do not bypass it. A refusal means wait or arrange a
   separately reviewed/authorized remote upload path. This CI job grants neither.
5. Only Release Engineer uploads the verified disposable payload, without a
   `functions` folder, after all gates. Do not call `scripts/deploy.sh`: that script
   installs/builds locally. The separately admitted uploader may use the documented
   precompiled command below; its availability and resource admission remain
   independent gates, and this document does not constitute deployment permission.

   ```sh
   wrangler pages deploy /absolute/new-disposable-payload --project-name postdelegate \
     --branch main --commit-hash <approved-merged-sha> --commit-dirty=false --no-bundle
   ```

6. Independently verify deployed source/digest, success, `uses_functions`, custom
   domain, the four new routes, hub links/sitemap, canonical/FAQ/CTA and prior
   docs negotiation, security headers, Markdown and static-asset regressions.
   Submit IndexNow separately only after approved deployment against the verified
   sitemap (require 200/202). Roll back to the captured prior deployment if checks
   fail. Record actual deployment and rollback evidence before marking the backlog
   shipped. Clicks do not establish trials or paid conversions.

Official CLI references checked for this implementation:
[Pages compile/dev/deploy commands](https://developers.cloudflare.com/workers/wrangler/commands/pages/),
[preprocessed no-bundle output](https://developers.cloudflare.com/workers/wrangler/bundling/),
[pnpm standalone install](https://pnpm.io/cli/install#--ignore-workspace).
No CLI was installed or run locally for this task.
