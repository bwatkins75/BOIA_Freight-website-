# boiafreight.com

Static marketing site for BOIA Freight. Single self-contained `index.html` —
no build step, no dependencies, no framework.

## Structure

- `index.html` — the whole site plus all four tech sheets
- `amplify.yml` — AWS Amplify build config (no build, just deploy)
- `404.html` — redirects stray paths back to the site

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
