# @harieshwar-ai/price-feeds

Reusable TypeScript **ESM** library for fetching retail commodity prices. **GPUs first**, **Canada-first**, **cleared sources only** — a open replacement for the closed Pricify data used by [rtx.live](https://rtx.live) / [canada-gpu-tracker](https://github.com/harieshwar-ai/canada-gpu-tracker).

## Install

```bash
npm install @harieshwar-ai/price-feeds
```

Node **20+** required. Works in **Deno** (e.g. Supabase Edge Functions) via `npm:` specifiers and web-standard `fetch` (no Node-only APIs in core).

## Quick start (Node)

```ts
import { createClient, normalizeGpu, getFxRate } from "@harieshwar-ai/price-feeds";

const client = createClient({
  userAgent: "MyApp/1.0 (+https://example.com)",
});

const adapter = client.getAdapter("canadacomputers");
const result = await adapter.fetchListing(
  "https://www.canadacomputers.com/en/powered-by-nvidia/282429/msi-geforce-rtx-5070-ti-16g-ventus-3x-pz-16gb-gddr7-graphics-card-rtx-5070-ti-16g-ventus-3x-pz-oc.html"
);
if (result.outcome !== "ok") throw new Error(result.message);
const offer = result.data;

console.log(offer.priceCents / 100, offer.currency, offer.stockOnline);

const norm = normalizeGpu(offer.title, { brand: offer.brand, mpn: offer.mpn });
const cad = offer.priceCents / 100;
const usd = cad * (await getFxRate("CAD", "USD"));
console.log(`~$${usd.toFixed(2)} USD (display only)`);
```

## Quick start (Deno / Supabase Edge)

```ts
import {
  createClient,
  type Offer,
} from "npm:@harieshwar-ai/price-feeds@0.1.0";

Deno.serve(async () => {
  const adapter = createClient().getAdapter("canadacomputers");
  const result = await adapter.fetchListing("282429");
  if (result.outcome !== "ok") {
    return Response.json(result, { status: 502 });
  }
  return Response.json(result.data);
});
```

## API sketch

| Export | Purpose |
|--------|---------|
| `createClient(opts?)` | Injectable `fetch`, `userAgent`, `timeoutMs` (default 20s) |
| `getAdapter(id)` | Returns a **cleared** adapter or **throws** |
| `listSources()` / `sources.json` | Registry of allowed retailers |
| `SourceAdapter.search(query)` | Search + fetch → `AdapterResult<Offer[]>` |
| `SourceAdapter.fetchListing(urlOrSku)` | Single listing → `AdapterResult<Offer>` |
| `SourceAdapter.getHealth()` | Per-run fetches, stop reason (`blocked` / `rate_limited`) |
| `resolveProductIdentity()` | **UPC/MPN-first** product key (title-only → unconfirmed) |
| `normalizeGpu()` | Title/MPN **proposals** for chip, VRAM, model line |
| `matchOffers(offers)` | Group by product + **condition** + seller; title-only → `review` |
| `computePriceEvents()` | Pure drop / restock / sellout helpers for observations |
| `getFxRate('USD','CAD')` | Bank of Canada Valet API (cached, display only) |
| `listCategories()` | Pluggable categories (`gpu` today) |

### `Offer`

`retailer`, `retailerSku`, `url`, `title`, `brand?`, `mpn?`, `upc?`, `priceCents`, `currency`, `condition` (`new` \| `open_box` \| `refurb` \| `used`), `stockOnline`, `storeStock[]`, `fetchedAt`, `sellerType`, `fetchId`.

### Adapter outcomes

`fetchListing` / `search` return `{ outcome: 'ok' \| 'blocked' \| 'rate_limited' \| 'not_found' \| 'parse_error', … }`. On **blocked** or **rate_limited**, the adapter **stops further fetches for that run** (no challenge retries). One bounded retry is used only for transient **5xx** or **timeouts**.

### Matching rules

- Product identity = **MPN / UPC / alias table** (`src/product/aliases.ts`). Condition and seller are **outside** identity.
- Title parsing alone lands in **`review`** until UPC/MPN confirms.
- **New / open-box / refurb / used** never share a match group (condition is on each `Offer`, never merged into one price).
- Marketplace offers **>50% below** the cheapest first-party **new** offer are flagged **`unconfirmedPrice`**.

### Observations (tracker storage)

This package defines append-only **`Observation`** rows and pure event helpers — **no Postgres client here**.

Suggested tracker schema (America/Toronto for daily rollups):

```text
observations(id, listing_id, price_cents, currency, stock_online, store_id nullable,
  seller_type, read_method, fetch_id, condition, observed_at timestamptz)
```

Ingest flow:

1. `fetchListing` → `AdapterResult` → map to `Offer` + `Observation` (`offerRef`, `venue`, `readMethod: 'cleared_page'`).
2. Insert observation; call `computePriceEvents(previous, current)` for alerts.
3. Drops **>30%** set `needsConfirmation` until a second read agrees (`confirmPendingLargeMove`).
4. Reads older than **72h** → `applyStalenessRule` (display as unknown / out of stock).
5. Daily low price per card: `date_trunc('day', observed_at AT TIME ZONE 'America/Toronto')` over confirmed first-party **new** observations.

### Cleared sources

Only sources with `"clearance": "cleared"` in [`sources.json`](./sources.json) can be used. `getAdapter('memoryexpress')` or `'bestbuy-ca'` **throws**.

Today:

| id | Status |
|----|--------|
| `canadacomputers` | **cleared** (adapter implemented) |
| `memoryexpress` | disabled |
| `bestbuy-ca`, `newegg-ca`, `amazon-ca`, `walmart-ca` | pending (no adapter) |

## Canada Computers adapter

Behaviour matches [canada-gpu-tracker `canada-computers.ts`](https://github.com/harieshwar-ai/canada-gpu-tracker/blob/main/supabase/functions/_shared/parsers/canada-computers.ts):

- JSON-LD + HTML fallback for title/price/SKU
- Online stock from `#delivery-text` (not pickup counts)
- Per-store stock across **42** mapped locations
- Open-box from title/URL only
- **7s** min interval between requests, **8** max fetches per run

## Tracker migration (follow-up PR)

The tracker ingest will pin this package instead of inlined parsers.

### Deno import (ingest function)

```ts
import { createClient } from "npm:@harieshwar-ai/price-feeds@0.1.0";

const cc = createClient().getAdapter("canadacomputers");

for (const { url } of skuList) {
  const offer = await cc.fetchListing(url);
  // map offer → Supabase rows (same fields as today)
}
```

### Before/after snapshot check

When switching ingest to the package:

1. Run ingest **once** with the **current** inlined parser; save `offers-before.json` (normalized `Offer[]` or your DB export).
2. Run ingest **once** with **`@harieshwar-ai/price-feeds`** on the same SKU list; save `offers-after.json`.
3. Diff JSON (keys: `retailerSku`, `priceCents`, `stockOnline`, `condition`, store stock counts):

```bash
diff -u offers-before.json offers-after.json
# or: jq -S . offers-before.json > a.json && jq -S . offers-after.json > b.json && diff -u a.json b.json
```

Accept when price, online stock, and per-store quantities match for cleared SKUs (timestamps and `fetchedAt` will differ).

## Development

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run smoke   # live Canada Computers fetch (one URL)
```

## License

MIT — see [LICENSE](./LICENSE).