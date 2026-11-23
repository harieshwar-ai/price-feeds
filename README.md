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
const offer = await adapter.fetchListing(
  "https://www.canadacomputers.com/en/powered-by-nvidia/282429/msi-geforce-rtx-5070-ti-16g-ventus-3x-pz-16gb-gddr7-graphics-card-rtx-5070-ti-16g-ventus-3x-pz-oc.html"
);

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
  const offer: Offer = await adapter.fetchListing("282429");
  return Response.json(offer);
});
```

## API sketch

| Export | Purpose |
|--------|---------|
| `createClient(opts?)` | Injectable `fetch`, `userAgent`, `timeoutMs` (default 20s) |
| `getAdapter(id)` | Returns a **cleared** adapter or **throws** |
| `listSources()` / `sources.json` | Registry of allowed retailers |
| `SourceAdapter.search(query)` | Search + fetch listings (rate-limited) |
| `SourceAdapter.fetchListing(urlOrSku)` | Single product page → `Offer` |
| `normalizeGpu(title, { brand?, mpn?, upc? })` | Canonical GPU key + confidence |
| `matchOffers(offers)` | Group by key; low confidence → `review` |
| `getFxRate('USD','CAD')` | Bank of Canada Valet API (cached, display only) |
| `listCategories()` | Pluggable categories (`gpu` today) |

### `Offer`

`retailer`, `retailerSku`, `url`, `title`, `brand?`, `mpn?`, `upc?`, `priceCents`, `currency`, `condition` (`new` \| `open_box` \| `refurb`), `stockOnline`, `storeStock[]`, `fetchedAt`.

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