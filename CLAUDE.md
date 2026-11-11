# CLAUDE.md

This repository hosts the static GitHub Pages origin and Cloudflare Worker edge layer for `logicleaptechnologies.com`.

## Project Overview

The human-facing site is plain static HTML/CSS. A small build script creates Markdown companions, and a Cloudflare Worker handles content negotiation and request logging. The site is designed for:

- Company homepage and service pages.
- Google Play style privacy, support, and data deletion URLs.
- Stripe/payment-review style refund, terms, contact, and security pages.
- Search engine crawling with `robots.txt`, `sitemap.xml`, canonical URLs, and basic structured data.
- AI-agent discovery through `llms.txt`, stable Markdown URLs, and `Accept: text/markdown` negotiation.

## Development

Open `index.html` directly in a browser, or serve the repository root locally:

```sh
python3 -m http.server 4188 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:4188/
```

Install the development tools and regenerate Markdown after changing page content:

```sh
npm install
npm run build:markdown
npm run check
```

## Important Files

- `index.html` - homepage
- `services.html` - services overview
- `contact.html` - public business contact page
- `support.html` - app/product support page
- `privacy-policy.html` - public privacy policy URL
- `data-deletion.html` - account/data deletion instructions
- `refund-policy.html` - refund, cancellation, fulfillment, and payment policy
- `security.html` - security and payment handling information
- `terms.html` - terms of service
- `robots.txt` - crawler permissions
- `sitemap.xml` - search sitemap
- `llms.txt` - AI-agent directory and stable Markdown page URLs
- `llms-full.txt` - generated full-site Markdown document
- `*.md` - generated Markdown companion for each HTML page
- `scripts/generate-markdown.mjs` - Markdown generator
- `theme-init.js` - synchronous saved-theme bootstrap used before CSS loads
- `worker/index.ts` - negotiation, alternate response headers, and structured request logs
- `wrangler.jsonc` - Cloudflare Worker route and observability configuration
- `.well-known/security.txt` - security contact
- `.nojekyll` - required so GitHub Pages serves dot-prefixed folders such as `.well-known`
- `CNAME` - custom domain configuration for `logicleaptechnologies.com`
- `assets/logo.png` - source logo asset
- `assets/favicon-*.png` and `assets/icon-*.png` - optimized browser and app icons
- `assets/og-image.jpg` - 1200×630 social preview image

## Deployment

GitHub Pages serves the `main` branch as the origin. The Cloudflare Worker runs on `logicleaptechnologies.com/*` in front of that origin.

Deployment path:

1. Edit static files in the root.
2. Run `npm run build:markdown` and `npm run check`.
3. Verify locally with a simple HTTP server.
4. Commit and push to `origin/main` so GitHub Pages publishes the static files.
5. Run `npm run deploy:worker` when `worker/index.ts` or `wrangler.jsonc` changes.

Do not remove `CNAME` or `.nojekyll`.

## Certificate renewal route

Preserve this Cloudflare zone-level route, with no Worker assigned:

- Pattern: `http://logicleaptechnologies.com/.well-known/acme-challenge/*`
- Worker: None

This more specific route lets GitHub Pages answer Let's Encrypt HTTP-01 certificate challenges directly. The site's Worker otherwise sends requests to the HTTPS origin, including incoming HTTP challenges. If the origin certificate is invalid, Full (strict) rejects that connection and can block the challenge needed to renew the certificate.

Manage this exception separately from the Worker's `env.production.routes` in `wrangler.jsonc`. Do not add the challenge pattern to that array: ordinary Wrangler route entries assign the pattern to the Worker. Keep the no-Worker exception when changing Cloudflare routing, and verify it after future Worker deployments.

Check the route with a nonexistent token:

```sh
curl --max-time 15 -sS -D - -o /dev/null http://logicleaptechnologies.com/.well-known/acme-challenge/route-check
```

The request should reach GitHub Pages and return HTTP 404 with GitHub response headers, rather than Cloudflare 526. A nonexistent token's 404 confirms routing only; verify successful certificate issuance separately in GitHub Pages settings. Keep ordinary HTTPS traffic on Full (strict), and confirm Enforce HTTPS is enabled in GitHub Pages after certificate provisioning completes.
