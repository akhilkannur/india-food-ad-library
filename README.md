# Indian Food Ad Library

A media-first catalogue of approved ads from Indian food and beverage brands, with a private moderation queue.

## Included

- Public ad discovery with search, category filters, sorting and an ad-detail drawer
- Private `/admin` review queue with pending, approved and rejected states
- Single-admin, signed HTTP-only session authentication
- Supabase Postgres schema with public read access limited to approved ads
- Demo mode when Supabase is not configured
- Weekly GitHub Actions Meta collector that queues new Ad Library records as `pending`
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

The scheduled workflow runs every Monday at 05:17 Asia/Kolkata. It uses the MIT-licensed `meta-ads-collector` package on the GitHub runner—never on the Cloudflare build or your machine—to query Meta's public Ad Library GraphQL service for the Indian food brands in `data/brands.json`. The dependency handles Meta's session tokens, request fingerprint, pagination, retries and changing response shapes.

For each discovery it:

1. Extracts the Meta Library ID, source link, copy and available creative URLs.
2. Upserts the real brand record.
3. Deduplicates by `platform + source_ad_id`.
4. Inserts only new ads with `status = pending`.
5. Uploads a 14-day run report as a private GitHub Actions artifact.

Meta changes its public UI regularly. A run that discovers zero ads fails visibly instead of silently reporting success, so selector changes can be repaired.

The workflow needs these GitHub Actions repository secrets:

```text
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

You can also run the workflow manually with a small `brand_limit` for a smoke test.

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
