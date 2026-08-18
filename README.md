# Indian Food Ad Library

A media-first catalogue of approved ads from Indian food and beverage brands, with a private moderation queue.

## Included

- Public ad discovery with search, category filters, sorting and an ad-detail drawer
- Private `/admin` review queue with pending, approved and rejected states
- Single-admin, signed HTTP-only session authentication
- Supabase Postgres schema with public read access limited to approved ads
- Demo mode when Supabase is not configured
- Weekly GitHub Actions importer that queues records as `pending`
- Responsive layouts for 320, 375, 414 and 768 px viewports

The demo brands and creatives are fictional placeholders. Replace them with verified source records before launch.

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

## Queue ads for approval

Copy `data/queue.example.json` to `data/queue.json`, replace the sample values, then run:

```bash
npm run import:queue
```

Every imported record enters the admin queue as `pending`. The scheduled GitHub workflow runs Sundays at 03:17 Asia/Kolkata and does the same import when `data/queue.json` exists.

The workflow intentionally imports prepared records; it does not scrape Meta. Automated collection from Meta requires platform permission and should not be hidden inside the deployment workflow.

## Deployment

This repository is configured for Cloudflare Workers through the OpenNext adapter. Workers is required because the moderation backend uses server-rendered routes, signed cookies and API handlers; a static Pages export would remove those features.

### Git-connected deployment

1. Push this folder to a GitHub repository.
2. In Cloudflare, create a Worker and connect the repository under **Workers Builds**.
3. Set the root directory to this project if it lives inside a larger repository.
4. Use `npm run deploy` as the deploy command.
5. Add all five environment variables under **Build variables and secrets** and to the Worker runtime secrets.

Cloudflare installs the dependencies and performs the build remotely. No local `node_modules` directory is required.

For a direct CLI deployment from any CI environment, run `npm run deploy` after authenticating Wrangler.

## Next production steps

- Replace demo content with the first verified brand list
- Add authorised thumbnails to Supabase Storage or Cloudflare R2
- Add reviewer notes and bulk moderation only after the single-record flow has been used in practice
- Connect an authorised ingestion source to produce `data/queue.json`
