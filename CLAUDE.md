# CLAUDE.md

This repository hosts the static GitHub Pages website for `logicleaptechnologies.com`.

## Project Overview

The site is a plain static HTML/CSS website with no build step. It is designed for:

- Company homepage and service pages.
- Google Play style privacy, support, and data deletion URLs.
- Stripe/payment-review style refund, terms, contact, and security pages.
- Search engine crawling with `robots.txt`, `sitemap.xml`, canonical URLs, and basic structured data.

## Development

Open `index.html` directly in a browser, or serve the repository root locally:

```sh
python3 -m http.server 4188 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:4188/
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
- `.well-known/security.txt` - security contact
- `.nojekyll` - required so GitHub Pages serves dot-prefixed folders such as `.well-known`
- `CNAME` - custom domain configuration for `logicleaptechnologies.com`
- `assets/logo.png` - logo/favicon/hero asset
- `assets/og-image.png` - social preview image

## Deployment

GitHub Pages serves the `main` branch from the repository root.

Deployment path:

1. Edit static files in the root.
2. Verify locally with a simple HTTP server.
3. Commit to `main`.
4. Push to `origin/main`.

Do not remove `CNAME` or `.nojekyll`.
