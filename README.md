# Indian Food Ad Library

A media-first catalogue of approved ads from Indian food and beverage brands, with a private moderation queue.

## Included

- Public ad discovery with search, category filters, sorting and an ad-detail drawer
- Private `/admin` review queue with pending, approved and rejected states
- Single-admin, signed HTTP-only session authentication
- Supabase Postgres schema with public read access limited to approved ads
- Demo mode when Supabase is not configured
- Weekly Cloudflare Browser Run collector that queues new Meta Ad Library records as `pending`
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

The `india-food-ad-scraper` Worker runs every day at 05:17 Asia/Kolkata. It rotates through four-brand batches, so the full list is refreshed every six days without exceeding Browser Run's free-plan launch and request limits. It renders Meta's public Ad Library for the Indian brands in `scraper-worker/src/brands.js`. The earlier MIT-licensed `meta-ads-collector` implementation remains in `scraper/` as a local or self-hosted fallback.

For each discovery it:

1. Extracts the Meta Library ID, source link, copy and available creative URLs.
2. Upserts the real brand record.
3. Deduplicates by `platform + source_ad_id`.
4. Inserts new ads with `status = pending`, while refreshing media URLs without changing existing approval decisions.
5. Returns a compact run report with per-brand discovery counts.

Meta changes its public UI regularly, so every candidate is brand-page matched and still requires approval in `/admin`. The public library never exposes pending records.

The Worker stores `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `RUN_TOKEN` as encrypted runtime secrets. Its public `/health` endpoint contains no credentials, and `/run` requires the run token.

Cloudflare Cron is the rotating daily scheduler. The GitHub Actions workflow is a manual fallback and run-report UI; it needs:

```text
SCRAPER_WORKER_URL
SCRAPER_RUN_TOKEN
```

You can run one brand or a four-brand batch from any offset in the GitHub Actions form.

## Manual queue import

Copy `data/queue.example.json` to `data/queue.json`, replace the sample values, then run:

```bash
npm run import:queue
```

Every manually imported record also enters the admin queue as `pending`.

## Deployment

This repository is configured for Cloudflare Workers through the OpenNext adapter. Workers is required because the moderation backend uses server-rendered routes, signed cookies and API handlers; a static Pages export would remove those features.

### Git-connected deployment

1. Push this folder to a GitHub repository.
2. In Cloudflare, create a Worker and connect the repository under **Workers Builds**.
3. Set the root directory to this project if it lives inside a larger repository.
4. Use `npx opennextjs-cloudflare deploy -- --keep-vars` as the deploy command after the OpenNext build command.
5. Add all five environment variables under **Build variables and secrets** and to the Worker runtime secrets.

Cloudflare installs the dependencies and performs the build remotely. No local `node_modules` directory is required.

For a direct CLI deployment from any CI environment, run `npm run deploy` after authenticating Wrangler.

## Storage note

The first version references creative media served by the source platform, so those URLs may expire. Once the scraper is stable, approved creatives can be copied to Supabase Storage or Cloudflare R2 within their free tiers.
