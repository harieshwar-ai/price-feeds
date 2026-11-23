export type {
  Clearance,
  SourceClearanceStatus,
  OfferCondition,
  StockOnline,
  StoreStockEntry,
  Offer,
  SellerType,
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

export type {
  AdapterOutcome,
  AdapterResult,
  SourceHealthSummary,
} from "./adapter-result.js";

export {
  createClient,
  getAdapter,
  DEFAULT_USER_AGENT,
  DEFAULT_TIMEOUT_MS,
} from "./client.js";
export { listSources, assertSourceCleared } from "./registry.js";
export {
  normalizeGpu,
  buildGpuKeyString,
  parseCompactMpnFragment,
  conditionFromTitle,
} from "./normalize/gpu.js";
export type {
  NormalizeGpuInput,
  NormalizeGpuResult,
  GpuCanonicalKey,
} from "./normalize/gpu.js";
export { matchOffers } from "./match-offers.js";
export type {
  MatchOffersResult,
  MatchedOfferGroup,
  MatchOffersOptions,
} from "./match-offers.js";
export {
  resolveProductIdentity,
  offerGroupKey,
} from "./product/identity.js";
export type { ProductIdentity } from "./product/identity.js";
export {
  lookupByMpn,
  lookupByUpc,
  resolveProductAlias,
} from "./product/aliases.js";
export type { ProductAliasRecord } from "./product/aliases.js";
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
export {
  computePriceEvents,
  applyStalenessRule,
  observationIsStale,
  effectiveStock,
  confirmPendingLargeMove,
  offerRefFromParts,
} from "./observations.js";
export type {
  Observation,
  PriceEvent,
  PriceEventType,
  ObservationVenue,
  ReadMethod,
} from "./observations.js";