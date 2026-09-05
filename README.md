# Indian Food Ad Library

A media-first catalogue of approved ads from Indian food and beverage brands, with a private moderation queue.

## Included

- Public ad discovery with search, controlled product-category, creative-style, message-angle and language filters, sorting and an ad-detail drawer
- Private `/admin` review queue with pending, approved and rejected states
- Single-admin, signed HTTP-only session authentication
- Supabase Postgres schema with public read access limited to approved ads
- Demo mode when Supabase is not configured
- Weekly Cloudflare Browser Run collector with separate bulk-backfill and refresh modes
- Responsive layouts for 320, 375, 414 and 768 px viewports

The public library only shows approved records. Automated discoveries remain private until reviewed.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. In local demo mode, `/admin` is available without authentication and moderation decisions are held only in the browser.

## Connect the backend

1. Create a free Supabase project.
2. Run `supabase/migrations/001_initial.sql` in the Supabase SQL editor.
3. Optionally run `supabase/seed.sql`.
4. Copy `.env.example` to `.env.local` and fill in:

```text
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_EMAIL=
ADMIN_PASSWORD=
AUTH_SECRET=
```

Generate `AUTH_SECRET` with a password manager or `openssl rand -base64 32`. Keep the service-role key server-side. It bypasses row-level security and must never be prefixed with `NEXT_PUBLIC_`.

## Automated collection and approval

The `india-food-ad-scraper` Worker covers 168 Indian food and beverage brands from `scraper-worker/src/brands.js`, with the expanded catalogue focused on digital-first and D2C brands. Its normal refresh runs once a week on Sunday morning in seven 24-brand batches between 06:00 and 09:00 Asia/Kolkata. The batches use one Browser Run session with up to three isolated pages, so the collector finishes in a bounded window instead of running continuously. The earlier MIT-licensed `meta-ads-collector` implementation remains in `scraper/` as a local or self-hosted fallback.

The Worker has two collection modes:

- `backfill` scans deeper history, considers up to 80 raw ads and queues up to 60 ads per high-volume brand. Manual batches are capped at 12 brands.
- `refresh` scans the latest inventory, considers up to 40 raw ads and queues up to 20 new ads per high-volume brand. Scheduled batches are capped at 24 brands.

For each discovery it:

1. Extracts the Meta Library ID, source link, copy and available creative URLs.
2. Upserts the real brand record.
3. Deduplicates exact Meta IDs, identical media URLs and near-identical copy variants.
4. Orders candidates across format, creative style, selling angle and hook clusters. Clusters are not hard-capped, so diversity ordering does not discard otherwise valid inventory.
5. Inserts selected ads with `status = pending`, while refreshing existing media URLs without changing approval decisions.
6. Returns per-brand counts for discovered, queued, refreshed, similarity-filtered and capacity-limited ads.

Meta changes its public UI regularly, so every candidate is brand-page matched and still requires approval in `/admin`. The public library never exposes pending records.

The Worker stores `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `RUN_TOKEN` as encrypted runtime secrets. Fast heuristic labels are applied during collection. Workers AI image classification runs separately after ads are stored, using the `/classify` endpoint. Its public `/health` endpoint contains no credentials, and protected run and classification endpoints require the run token.

Run `supabase/migrations/002_ai_classifications.sql` after the initial schema migration. It adds the reviewed `creative_style` and `selling_angle` fields used by the public catalogue and moderation queue.

### Workers AI classification

The manual `Classify ads` workflow classifies selected pending or approved ads with exactly one value for each of four fields: product category, creative style, selling angle and language. Image ads use their creative; video ads use a Cloudflare-generated four-frame contact sheet from the first eight seconds. Results are saved to the existing `category`, `creative_style`, `selling_angle` and `language` columns. Offers are not used as a collection.

Run the workflow in batches of 10–25 ads. Increase `offset` by the previous batch size for the next run. The read-only `Run Workers AI classification pilot` workflow remains available for testing without database writes.

Cloudflare Cron runs the weekly refresh. The GitHub Actions workflow is the bulk-backfill control and manual fallback; it needs:

```text
SCRAPER_WORKER_URL
SCRAPER_RUN_TOKEN
```

For the initial backfill, run 12-brand batches at offsets `0`, `12`, `24`, and so on through `156`. Use `mode=refresh` for a lighter manual update. Every run remains finite; there is no persistent browser process. The optional `publish` control bulk-approves pending records only when they have both a Meta ID and creative media; it remains off by default so ordinary collection continues to use the review queue.

## Manual queue import

Copy `data/queue.example.json` to `data/queue.json`, replace the sample values, then run:

```bash
npm run import:queue
```

Every manually imported record also enters the admin queue as `pending`.

## Deployment

This repository is configured for Cloudflare Workers through the OpenNext adapter. Workers is required because the moderation backend uses server-rendered routes, signed cookies and API handlers; a static Pages export would remove those features.

### Canonical GitHub deployment

Every push to `main` runs `.github/workflows/deploy.yml`, which installs dependencies, builds with OpenNext, and deploys this Worker with Wrangler.

The workflow requires the GitHub repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Configure those once under **Settings → Secrets and variables → Actions**.

Cloudflare installs the dependencies and performs the build remotely. No local `node_modules` directory is required.

Do not use a local CLI deployment for normal releases; push to `main` and check the **Deploy site to Cloudflare** workflow instead.

## Storage note

The first version references creative media served by the source platform, so those URLs may expire. Once the scraper is stable, approved creatives can be copied to Supabase Storage or Cloudflare R2 within their free tiers.
