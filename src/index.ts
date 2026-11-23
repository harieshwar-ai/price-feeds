export type {
  Clearance,
  SourceClearanceStatus,
  OfferCondition,
  StockOnline,
  StoreStockEntry,
  Offer,
  RateLimit,
  SearchOptions,
  FetchListingOptions,
  FetchFn,
  AdapterContext,
  SourceAdapter,
  SourceRecord,
  SourcesFile,
  PriceFeedsClientOptions,
  PriceFeedsClient,
} from "./types.js";

export {
  createClient,
  getAdapter,
  DEFAULT_USER_AGENT,
  DEFAULT_TIMEOUT_MS,
} from "./client.js";
export { listSources, assertSourceCleared } from "./registry.js";
export { normalizeGpu, buildGpuKeyString } from "./normalize/gpu.js";
export type {
  NormalizeGpuInput,
  NormalizeGpuResult,
  GpuCanonicalKey,
} from "./normalize/gpu.js";
export { matchOffers } from "./match-offers.js";
export type { MatchOffersResult, MatchedOfferGroup } from "./match-offers.js";
export { getFxRate } from "./fx.js";
export { listCategories, getCategory } from "./categories/registry.js";
export {
  GPU_CATEGORY_ID,
  type GpuOfferSpec,
  type CommodityCategoryId,
} from "./categories/gpu-schema.js";
export {
  parseCanadaComputersProductHtml,
  detectOpenBox,
} from "./adapters/canada-computers-parse.js";