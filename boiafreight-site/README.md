# boiafreight.com

Static marketing site for BOIA Freight. Single self-contained `index.html` —
no build step, no dependencies, no framework.

## Structure

- `index.html` — the whole site plus all four tech sheets. Graphics are inline
  SVG (an icon sprite at the top of `<body>`) and HTML/CSS product mockups, so
  they follow the light/dark theme tokens with no image files.
- `favicon.ico` — 16/32/48 px, built from the brand kit's lane-cut chevrons
- `site.webmanifest` — PWA/Android icon manifest
- `assets/` — favicon.svg, apple-touch-icon.png, icon-192/512.png, og.png
  (social card), plus the brand lockups from the kit for reuse
- `amplify.yml` — AWS Amplify build config (no build, just deploy)
- `404.html` — redirects stray paths back to the site

## Brand

Colors: slate `#2B3440`, electric blue `#2F7BFF`, white. Type: Inter.
The brand kit source lives outside the repo (Downloads/Logo BOIA Freight).
Icons: the `<symbol id="i-...">` set in `index.html`; add a new one there and
reference it with `<svg class="ico"><use href="#i-name"/></svg>`.

## The tech sheets

The four sheets live inside `index.html` as hash routes:

| Sheet | URL |
|---|---|
| Platform overview | `/#sheet-overview` |
| How a load moves | `/#sheet-workflow` |
| Getting started | `/#sheet-cutover` |
| Where the return comes from | `/#sheet-roi` |

Each has print styles, so "Save as PDF" produces a clean one-pager with the
nav stripped out. To edit one, find its `<div class="sheetview" id="sheet-...">`
block in `index.html`.

## Deploying (AWS Amplify)

1. Push this repo to GitHub.
2. Amplify Console → New app → Host web app → connect the repo.
3. Amplify reads `amplify.yml`. No build command needed.
4. Add `boiafreight.com` under Domain management. Amplify issues the TLS cert
   and writes the Route 53 records if the domain is in the same account.

Every push to `main` redeploys.

## Local preview

Open `index.html` in a browser, or:

    python3 -m http.server 8000

## To do later

- Scheduling embed — paste the Cal.com or Calendly snippet into the
  `#calendar-embed` div in the demo section and remove `display:none`.
- Analytics — add the Plausible script tag before `</head>`.
- Pricing page — intentionally left off.

## Contact

brian@boia.solutions
