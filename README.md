# Searchable 13F Dashboard

Next.js dashboard for searching SEC filers and loading the latest 13F portfolio snapshots from official EDGAR data.

## Local Development

```bash
npm install
SEC_USER_AGENT="Your Name your.email@example.com" npm run dev
```

Open `http://localhost:3000` and search by CIK, ticker, or company name. Private 13F managers are most reliably found by exact CIK.

## Environment

- `SEC_USER_AGENT` is required for SEC API requests.
- `KV_REST_API_URL` and `KV_REST_API_TOKEN` enable Vercel KV caching in production.
- Without KV credentials, the app uses an in-memory cache for local development.

## Checks

```bash
npm run typecheck
npm test
npm run build
```

## Deployment

Deploy on Vercel, set `SEC_USER_AGENT`, and connect Vercel KV for persistent caching. The app caches the SEC company mapping for 24 hours and fund payloads by `CIK + latest accession`.

## Data Notes

Data comes from SEC EDGAR 13F-HR information tables. 13F disclosures are delayed snapshots and omit shorts, cash, many derivatives, and non-reportable holdings. Ticker and sector enrichment is best effort and non-authoritative.
