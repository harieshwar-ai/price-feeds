import { createClient } from "../src/client.js";

const DEFAULT_URL =
  "https://www.canadacomputers.com/en/powered-by-nvidia/282429/msi-geforce-rtx-5070-ti-16g-ventus-3x-pz-16gb-gddr7-graphics-card-rtx-5070-ti-16g-ventus-3x-pz-oc.html";

const url = process.argv[2] ?? DEFAULT_URL;

const client = createClient();
const adapter = client.getAdapter("canadacomputers");

console.log("Smoke fetchListing:", url);
const result = await adapter.fetchListing(url);

if (result.outcome !== "ok") {
  console.log(JSON.stringify(result, null, 2));
  console.log("Health:", adapter.getHealth());
  process.exit(1);
}

const offer = result.data;
const storesWithStock = offer.storeStock.filter((s) =>
  typeof s.qty === "number" ? s.qty > 0 : s.qty === "in_stock"
);

console.log(
  JSON.stringify(
    {
      outcome: result.outcome,
      title: offer.title,
      sku: offer.retailerSku,
      mpn: offer.mpn,
      upc: offer.upc,
      priceCents: offer.priceCents,
      currency: offer.currency,
      stockOnline: offer.stockOnline,
      condition: offer.condition,
      storesWithStock: storesWithStock.length,
      storeStockSample: storesWithStock.slice(0, 5),
      fetchedAt: offer.fetchedAt,
      health: adapter.getHealth(),
    },
    null,
    2
  )
);