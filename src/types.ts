import type { AdapterResult, SourceHealthSummary } from "./adapter-result.js";

export type Clearance = "official_api" | "affiliate_feed" | "cleared_page";

export type SourceClearanceStatus =
  | "cleared"
  | "pending"
  | "disabled";

export type OfferCondition = "new" | "open_box" | "refurb" | "used";

export type SellerType = "first_party" | "marketplace" | "unknown";

export type StockOnline = "in_stock" | "out_of_stock" | "unknown";

export interface StoreStockEntry {
  storeId: string;
  storeName: string;
  qty: number | "in_stock";
}

export interface Offer {
  retailer: string;
  retailerSku: string;
  url: string;
  title: string;
  brand?: string;
  mpn?: string;
  upc?: string;
  priceCents: number;
  currency: string;
  condition: OfferCondition;
  stockOnline: StockOnline;
  storeStock: StoreStockEntry[];
  fetchedAt: string;
  sellerType?: SellerType;
  sourceId?: string;
  fetchId?: string;
  /** Set when a marketplace offer is >50% below the cheapest legit first-party offer. */
  unconfirmedPrice?: boolean;
}

export interface RateLimit {
  /** Minimum milliseconds between HTTP requests to this retailer. */
  minIntervalMs: number;
  /** Maximum listing fetches allowed in one client run. */
  maxPerRun: number;
}

export interface SearchOptions {
  limit?: number;
}

export interface FetchListingOptions {
  /** Override client default timeout for this call. */
  timeoutMs?: number;
}

export type FetchFn = typeof globalThis.fetch;

export interface AdapterContext {
  fetch: FetchFn;
  userAgent: string;
  timeoutMs: number;
}

export interface SourceAdapter {
  readonly id: string;
  readonly retailer: string;
  readonly country: string;
  readonly currency: string;
  readonly clearance: Clearance;
  readonly rateLimit: RateLimit;

  search(query: string, opts?: SearchOptions): Promise<AdapterResult<Offer[]>>;
  fetchListing(
    urlOrSku: string,
    opts?: FetchListingOptions
  ): Promise<AdapterResult<Offer>>;
  getHealth(): SourceHealthSummary;
}

export interface SourceRecord {
  id: string;
  retailer: string;
  country: string;
  currency: string;
  clearance: SourceClearanceStatus;
  clearanceType: Clearance | null;
  clearedDate: string | null;
  notes: string;
}

export interface SourcesFile {
  sources: SourceRecord[];
}

export interface PriceFeedsClientOptions {
  fetch?: FetchFn;
  userAgent?: string;
  /** Default request timeout in ms (default 20_000). */
  timeoutMs?: number;
}

export interface PriceFeedsClient {
  getAdapter(id: string): SourceAdapter;
  listSources(): SourceRecord[];
}