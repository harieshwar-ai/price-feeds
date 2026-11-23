import { describe, expect, it } from "vitest";
import { matchOffers } from "../src/match-offers.js";
import type { Offer } from "../src/types.js";

function offer(partial: Partial<Offer> & Pick<Offer, "retailerSku" | "title">): Offer {
  return {
    retailer: "Canada Computers",
    url: `https://example.com/${partial.retailerSku}`,
    priceCents: partial.priceCents ?? 199_999,
    currency: "CAD",
    condition: partial.condition ?? "new",
    stockOnline: "in_stock",
    storeStock: [],
    fetchedAt: new Date().toISOString(),
    sellerType: partial.sellerType ?? "first_party",
    sourceId: "canadacomputers",
    mpn: partial.mpn ?? "RTX 5070 Ti 16G VENTUS 3X PZ OC",
    upc: partial.upc ?? "824142448151",
    ...partial,
  };
}

describe("matchOffers UPC/MPN-first", () => {
  it("sends title-only offers to review", () => {
    const { groups, review } = matchOffers([
      offer({ retailerSku: "x1", title: "MSI RTX 5070 Ti 16G VENTUS 3X", mpn: undefined, upc: undefined }),
    ]);
    expect(review).toHaveLength(1);
    expect(groups).toHaveLength(0);
  });

  it("never groups new with open_box for the same product", () => {
    const base = {
      title: "MSI GeForce RTX 5070 Ti 16G VENTUS 3X PZ OC",
      mpn: "RTX 5070 Ti 16G VENTUS 3X PZ OC",
      upc: "824142448151",
    };
    const { groups } = matchOffers([
      offer({ retailerSku: "n1", ...base, condition: "new", priceCents: 200_000 }),
      offer({ retailerSku: "o1", ...base, condition: "open_box", priceCents: 180_000 }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.condition).sort()).toEqual(["new", "open_box"]);
    expect(groups[0]!.offers).toHaveLength(1);
  });

  it("flags marketplace offers far below legit floor", () => {
    const { unconfirmed, groups } = matchOffers([
      offer({
        retailerSku: "legit",
        title: "MSI RTX 5070 Ti",
        priceCents: 100_000,
        sellerType: "first_party",
      }),
      offer({
        retailerSku: "scam",
        title: "MSI RTX 5070 Ti",
        priceCents: 40_000,
        sellerType: "marketplace",
      }),
    ]);
    expect(unconfirmed).toHaveLength(1);
    expect(unconfirmed[0]!.retailerSku).toBe("scam");
    expect(groups.length).toBeGreaterThanOrEqual(1);
  });
});