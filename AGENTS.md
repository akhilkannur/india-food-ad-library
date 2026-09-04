# Project instructions

## Deployment

- This site deploys to **Cloudflare Workers** through `.github/workflows/deploy.yml`.
- The canonical deployment path is a push to `main`; GitHub Actions builds with OpenNext and deploys with Wrangler.
- Do not use Vercel, Cloudflare Pages, a local Wrangler deploy, or any alternate deployment route for this project unless the user explicitly asks to change the deployment architecture.
- Do not install dependencies locally just to deploy. The GitHub runner installs them remotely with `npm install --legacy-peer-deps --no-package-lock`.
- Required GitHub repository secrets are `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- After pushing deployment-related changes, check the **Deploy site to Cloudflare** workflow and report its result.

The scraper has separate secrets (`SCRAPER_RUN_TOKEN` and `SCRAPER_WORKER_URL`) and a separate workflow; do not confuse those with site deployment.
