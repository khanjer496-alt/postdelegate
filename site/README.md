# PostDelegate marketing site

Astro static marketing site for https://postdelegate.com, maintained beside the Postiz application in this repository.

## Build and preview

Use Node.js 22 and pnpm. From this directory:

    pnpm install --frozen-lockfile
    pnpm run build
    node scripts/serve.mjs 4321
    node scripts/check-urls.mjs

The build packages the website source at /website-source.tar.gz. It includes source, assets, dependency lockfile and license; excludes installed dependencies, build outputs and local configuration. Application source is separately offered at https://app.postdelegate.com/source.

## Deployment

Cloudflare Pages project postdelegate; production branch main; output dist. Upload a preview branch first and inspect desktop/mobile and interactions. Deploy the same tested build to main only after checks pass. The existing application/VPS stack is independent of this static deployment.

## Documentation

The documentation lives at /docs. Pages are Markdown files in src/pages/docs (rendered by src/layouts/DocsLayout.astro, which builds the on-page contents list from the headings); the sidebar, docs home, previous/next links, llms.txt and llms-full.txt all read the page list in src/data/docs.ts, so add a new page to both. Technical statements (endpoints, fields, limits, tool names) were written from the application code in apps/backend and libraries/nestjs-libraries; re-check them against the code when that code changes. node scripts/check-urls.mjs checks internal links and anchors, including the docs.

## Design and content

The page structure, typography, monochrome shell, pill controls, colourful feature panels and channel layout follow the current Postiz website as a visual reference. PostDelegate keeps its own identity, original copy, original interface illustrations and a real screenshot of the current branded app. It does not reuse Postiz testimonials, awards, customer photos or website artwork.

This site is adapted from Nasida Apps LLC's earlier PostDelegate Astro site (preserved BrightBean repository at c3a8298). Current product facts refer to the Postiz-based deployment. Social connections, public paid plans, AI and agent workflows remain a staged rollout; do not replace these disclosures with unverified launch claims.

The application is based on Postiz under AGPL-3.0; applicable website source is supplied under AGPL-3.0. Plus Jakarta Sans is redistributed with its SIL Open Font License in public/fonts/OFL.txt. Network glyphs are generated from Simple Icons (CC0); names/logos identify their respective services and imply no endorsement.
