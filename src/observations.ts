import type { OfferCondition, StockOnline } from "./types.js";

export type SellerType = "first_party" | "marketplace" | "unknown";
export type ReadMethod = "cleared_page" | "official_api" | "affiliate_feed";

export type ObservationVenue =
  | { kind: "online" }
  | { kind: "store"; storeId: string };

export interface Observation {
  offerRef: string;
  priceCents: number;
  currency: string;
  stock: StockOnline | { inStock: true; qty?: number };
  venue: ObservationVenue;
  sellerType: SellerType;
  readMethod: ReadMethod;
  fetchId: string;
  observedAt: string;
  condition: OfferCondition;
}

export type PriceEventType = "price_drop" | "restock" | "sellout";

export interface PriceEvent {
  type: PriceEventType;
  needsConfirmation: boolean;
  offerRef: string;
  observedAt: string;
  priceCents?: number;
  previousPriceCents?: number;
  stock?: StockOnline;
  previousStock?: StockOnline;
}

const DEFAULT_LARGE_MOVE_PCT = 0.3;
const DEFAULT_STALE_HOURS = 72;

function stockOnline(
  stock: Observation["stock"]
): StockOnline {
  if (typeof stock === "string") return stock;
  return "in_stock";
}

export function observationIsStale(
  obs: Observation,
  now: Date = new Date(),
  maxAgeHours = DEFAULT_STALE_HOURS
): boolean {
  const ageMs = now.getTime() - Date.parse(obs.observedAt);
  return ageMs > maxAgeHours * 60 * 60 * 1000;
}

/** Apply 72h staleness: unknown / treat as out of stock for display logic. */
export function applyStalenessRule(
  obs: Observation,
  now: Date = new Date(),
  maxAgeHours = DEFAULT_STALE_HOURS
): Observation {
  if (!observationIsStale(obs, now, maxAgeHours)) return obs;
  return {
    ...obs,
    stock: "unknown",
  };
}

export function effectiveStock(
  obs: Observation,
  now: Date = new Date()
): StockOnline {
  const stale = applyStalenessRule(obs, now);
  const s = stockOnline(stale.stock);
  if (observationIsStale(obs, now) && s === "unknown") {
    return "out_of_stock";
  }
  return s;
}

export function computePriceEvents(
  previous: Observation | null,
  current: Observation,
  opts?: { largeMovePct?: number }
): PriceEvent[] {
  const events: PriceEvent[] = [];
  const pct = opts?.largeMovePct ?? DEFAULT_LARGE_MOVE_PCT;

  const curStock = stockOnline(current.stock);
  const prevStock = previous ? stockOnline(previous.stock) : undefined;

  if (previous) {
    const drop = current.priceCents < previous.priceCents;
    if (drop) {
      const relDrop =
        (previous.priceCents - current.priceCents) / previous.priceCents;
      events.push({
        type: "price_drop",
        needsConfirmation: relDrop > pct,
        offerRef: current.offerRef,
        observedAt: current.observedAt,
        priceCents: current.priceCents,
        previousPriceCents: previous.priceCents,
      });
    }
    const wasOut =
      prevStock === "out_of_stock" || prevStock === "unknown";
    const isIn = curStock === "in_stock";
    if (wasOut && isIn) {
      events.push({
        type: "restock",
        needsConfirmation: false,
        offerRef: current.offerRef,
        observedAt: current.observedAt,
        stock: curStock,
        previousStock: prevStock,
      });
    }
    const wasIn = prevStock === "in_stock";
    if (wasIn && curStock === "out_of_stock") {
      events.push({
        type: "sellout",
        needsConfirmation: false,
        offerRef: current.offerRef,
        observedAt: current.observedAt,
        stock: curStock,
        previousStock: prevStock,
      });
    }
  }

  return events;
}

/** Second agreeing read clears needsConfirmation on large moves. */
export function confirmPendingLargeMove(
  priorEvent: PriceEvent,
  _previous: Observation,
  current: Observation,
  opts?: { largeMovePct?: number }
): boolean {
  if (!priorEvent.needsConfirmation || priorEvent.type !== "price_drop") {
    return false;
  }
  const pct = opts?.largeMovePct ?? DEFAULT_LARGE_MOVE_PCT;
  const baseline = priorEvent.previousPriceCents ?? 0;
  if (baseline <= 0) return false;
  const relDrop = (baseline - current.priceCents) / baseline;
  const agreesWithFirst =
    Math.abs(current.priceCents - (priorEvent.priceCents ?? 0)) /
      Math.max(1, priorEvent.priceCents ?? 1) <
    0.05;
  return relDrop > pct && agreesWithFirst;
}

export function offerRefFromParts(retailer: string, retailerSku: string): string {
  return `${retailer}::${retailerSku}`;
}