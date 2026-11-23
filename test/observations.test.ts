import { describe, expect, it } from "vitest";
import {
  applyStalenessRule,
  computePriceEvents,
  confirmPendingLargeMove,
  effectiveStock,
} from "../src/observations.js";
import type { Observation } from "../src/observations.js";

const obs = (partial: Partial<Observation>): Observation => ({
  offerRef: "cc::1",
  priceCents: 100_000,
  currency: "CAD",
  stock: "in_stock",
  venue: { kind: "online" },
  sellerType: "first_party",
  readMethod: "cleared_page",
  fetchId: "f1",
  observedAt: new Date().toISOString(),
  condition: "new",
  ...partial,
});

describe("observation events", () => {
  it("marks large price drops as needs_confirmation", () => {
    const prev = obs({ priceCents: 100_000, observedAt: "2026-01-01T00:00:00Z" });
    const cur = obs({ priceCents: 60_000, observedAt: "2026-01-02T00:00:00Z" });
    const events = computePriceEvents(prev, cur);
    expect(events.some((e) => e.type === "price_drop" && e.needsConfirmation)).toBe(
      true
    );
  });

  it("confirms large drop on second agreeing read", () => {
    const prev = obs({ priceCents: 100_000 });
    const first = obs({ priceCents: 60_000 });
    const events = computePriceEvents(prev, first);
    const pending = events.find((e) => e.needsConfirmation)!;
    const second = obs({ priceCents: 59_500 });
    expect(confirmPendingLargeMove(pending, first, second)).toBe(true);
  });

  it("applies 72h staleness as unknown/out_of_stock", () => {
    const old = obs({
      observedAt: new Date(Date.now() - 73 * 3600_000).toISOString(),
      stock: "in_stock",
    });
    const stale = applyStalenessRule(old);
    expect(stale.stock).toBe("unknown");
    expect(effectiveStock(old)).toBe("out_of_stock");
  });
});