# CHANGE Share Tower Worker

Cloudflare Worker for Share Tower tally counts. It stores village-level share/view counts in Workers KV.

## Endpoints

### `POST /tally`

Request body:

```json
{
  "city": "ntpc",
  "district": "板橋區",
  "village": "留侯里",
  "event": "share"
}
```

`event` must be `share` or `view`.

KV key:

```text
{city}-{district}-{village}
```

KV value:

```json
{
  "city": "ntpc",
  "district": "板橋區",
  "village": "留侯里",
  "shares": 23,
  "views": 41,
  "lastUpdate": 1714000000000
}
```

The Worker also writes a temporary lock key for `IP + village key` with a 10 minute TTL. When locked, the response has `counted: false`.

### `GET /counts?city=ntpc`

Response:

```json
{
  "city": "ntpc",
  "counts": {
    "ntpc-板橋區-留侯里": {
      "city": "ntpc",
      "district": "板橋區",
      "village": "留侯里",
      "shares": 23,
      "views": 41,
      "lastUpdate": 1714000000000
    }
  }
}
```

## Deploy

Current endpoint:

```text
https://change-tw.ileivoivm.workers.dev
```

KV binding:

```text
CHANGE_TALLY -> fb9b871a0c8e4a9595b27da13fdf2106
```

1. Login:

```bash
npx wrangler login
```

2. Create KV namespaces:

```bash
npx wrangler kv namespace create change-tally
npx wrangler kv namespace create change-tally --preview
```

3. Copy the returned IDs into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CHANGE_TALLY"
id = "..."
preview_id = "..."
```

4. Deploy:

```bash
npx wrangler deploy
```

5. Smoke test:

```bash
ENDPOINT="https://change-tw.ileivoivm.workers.dev"

curl -i -X POST "$ENDPOINT/tally" \
  -H "Content-Type: application/json" \
  -H "Origin: https://ileivoivm.github.io" \
  --data '{"city":"ntpc","district":"板橋區","village":"留侯里","event":"share"}'

curl -i "$ENDPOINT/counts?city=ntpc" \
  -H "Origin: https://ileivoivm.github.io"
```

## CORS

Allowed production origin:

```text
https://ileivoivm.github.io
```

Local development can be tested with curl or `wrangler dev`; browser calls from other origins are intentionally not allowed in this first pass.

## Local Verification

Run the Worker behavior smoke test:

```bash
npm run test:worker
```

Check Wrangler can bundle the Worker:

```bash
npx wrangler deploy --dry-run --outdir /tmp/change-tally-worker-dry-run
```
