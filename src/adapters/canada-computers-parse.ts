/**
 * HTML parsing for Canada Computers product pages.
 * Ported from canada-gpu-tracker `parsers/canada-computers.ts`.
 */
import storesData from "../data/canada-computers-stores.json" with { type: "json" };
import type { OfferCondition, StockOnline, StoreStockEntry } from "../types.js";

export interface CcStoreRecord {
  pageLabel: string;
  slug: string;
  name: string;
  city: string;
  provinceCode: string;
}

const BY_LABEL = new Map<string, CcStoreRecord>();
for (const store of storesData.stores as CcStoreRecord[]) {
  BY_LABEL.set(normalizeCcStoreLabel(store.pageLabel), store);
}

export function normalizeCcStoreLabel(label: string): string {
  return label
    .replace(/&amp;/g, "&")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function lookupCanadaComputersStore(
  rawLabel: string
): CcStoreRecord | null {
  return BY_LABEL.get(normalizeCcStoreLabel(rawLabel)) ?? null;
}

export interface ParsedCcProduct {
  title: string;
  brand: string;
  sku: string;
  mpn?: string;
  priceCad: number | null;
  stockOnline: StockOnline;
  condition: OfferCondition;
  storeStock: StoreStockEntry[];
}

export function parseCadPrice(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(/,/g, "");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function stockFromAvailability(availability: string | undefined): boolean {
  if (!availability) return false;
  const a = availability.toLowerCase();
  return a.includes("instock") || a.includes("in_stock");
}

export function detectOpenBox(text: string, url?: string): boolean {
  const t = text.toLowerCase();
  if (t.includes("open box") || t.includes("open-box")) return true;
  if (url?.toLowerCase().includes("openbox")) return true;
  return false;
}

function extractJsonLdProduct(html: string): Record<string, unknown> | null {
  const re =
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1]!) as Record<string, unknown>;
      if (data["@type"] === "Product") return data;
    } catch {
      /* skip */
    }
  }
  return null;
}

function parseStoreStock(html: string): StoreStockEntry[] {
  const stocks: StoreStockEntry[] = [];
  const blockRe =
    /<span class="col-3[^"]*"[^>]*>\s*([^<]+?)\s*<\/span>[\s\S]*?shop-online-box[^>]*>\s*(\d+)\s*<\/span>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html))) {
    const label = m[1]!.trim();
    const qty = Number.parseInt(m[2]!, 10);
    const mapped = lookupCanadaComputersStore(label);
    if (!mapped) continue;
    stocks.push({
      storeId: mapped.slug,
      storeName: mapped.name,
      qty: Number.isFinite(qty) ? qty : 0,
    });
  }
  return stocks;
}

/** Online ship stock from the Delivery panel — not store pickup counts. */
function parseOnlineStockFromHtml(
  html: string,
  schemaAvailability: string | undefined
): StockOnline {
  const deliveryMatch = html.match(/id="delivery-text"[^>]*>\s*([^<]+)/i);
  if (deliveryMatch) {
    const text = deliveryMatch[1]!.trim().toLowerCase();
    if (/sold\s+out\s+online/.test(text)) return "out_of_stock";
    if (
      /in\s+stock\s+online|available\s+online|ships\s+in|ready\s+to\s+ship/.test(
        text
      )
    ) {
      return "in_stock";
    }
  }
  let inStockOnline = stockFromAvailability(schemaAvailability);
  if (!inStockOnline && /product-available-for-order":true/.test(html)) {
    inStockOnline = !/SoldOut/i.test(schemaAvailability ?? "");
  }
  if (inStockOnline) return "in_stock";
  if (schemaAvailability?.toLowerCase().includes("soldout")) {
    return "out_of_stock";
  }
  return "unknown";
}

const BRANDS = [
  "NVIDIA",
  "ASUS",
  "MSI",
  "Gigabyte",
  "GIGABYTE",
  "ZOTAC",
  "PNY",
  "Palit",
  "EVGA",
  "Gainward",
  "ASRock",
  "PowerColor",
] as const;

export function extractBrand(text: string): string | null {
  for (const brand of BRANDS) {
    const re = new RegExp(
      `\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i"
    );
    if (re.test(text)) {
      return brand === "GIGABYTE" ? "Gigabyte" : brand;
    }
  }
  if (/\bGeForce\b/i.test(text)) return "NVIDIA";
  return null;
}

export function parseCanadaComputersProductHtml(
  html: string,
  url: string
): ParsedCcProduct | null {
  if (
    /page_name":"pagenotfound"/i.test(html) ||
    /"page_name":"pagenotfound"/.test(html)
  ) {
    return null;
  }

  const product = extractJsonLdProduct(html);
  const title =
    (product?.name as string | undefined) ??
    html
      .match(/<h1[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?.replace(/<[^>]+>/g, "")
      .trim() ??
    "";

  if (!title) return null;

  const brand =
    extractBrand(title) ??
    ((product?.brand as { name?: string } | undefined)?.name ?? "NVIDIA");

  const offers = product?.offers as
    | { price?: number; availability?: string }
    | undefined;
  const priceCad =
    typeof offers?.price === "number"
      ? offers.price
      : parseCadPrice(
          html.match(/current-price-value[^>]*>([^<]+)</i)?.[1] ??
            html.match(/\$[\d,]+\.?\d*/)?.[0] ??
            ""
        );

  const availability = offers?.availability as string | undefined;
  const stockOnline = parseOnlineStockFromHtml(html, availability);

  const sku =
    (product?.sku as string | undefined) ??
    html.match(/"product-id-(\d+)"/)?.[1] ??
    url.match(/\/(\d+)\/[^/]+\.html/)?.[1] ??
    "unknown";

  const openBox = detectOpenBox(title, url);
  const condition: OfferCondition = openBox ? "open_box" : "new";

  const storeStock = parseStoreStock(html);

  return {
    title,
    brand,
    sku,
    mpn: product?.mpn as string | undefined,
    priceCad,
    stockOnline,
    condition,
    storeStock,
  };
}

/** Build canonical product URL from numeric SKU. */
export function canadaComputersProductUrl(sku: string): string {
  return `https://www.canadacomputers.com/product_info.php?cPath=0&products_id=${encodeURIComponent(sku)}&language=en`;
}

export function resolveCanadaComputersFetchUrl(urlOrSku: string): string {
  if (/^https?:\/\//i.test(urlOrSku)) return urlOrSku;
  if (/^\d+$/.test(urlOrSku)) return canadaComputersProductUrl(urlOrSku);
  return urlOrSku;
}

export function parseCanadaComputersSearchHtml(
  html: string,
  baseUrl: string,
  limit: number
): string[] {
  const urls: string[] = [];
  const re =
    /href="(\/en\/[^"]+\/(\d+)\/[^"]+\.html)"/gi;
  let m: RegExpExecArray | null;
  const origin = new URL(baseUrl).origin;
  const seen = new Set<string>();
  while ((m = re.exec(html)) && urls.length < limit) {
    const path = m[1]!;
    const full = `${origin}${path}`;
    if (seen.has(full)) continue;
    seen.add(full);
    urls.push(full);
  }
  return urls;
}