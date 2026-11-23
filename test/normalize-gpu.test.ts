import { describe, expect, it } from "vitest";
import { normalizeGpu } from "../src/normalize/gpu.js";
import { matchOffers } from "../src/match-offers.js";
import type { Offer } from "../src/types.js";

const CASES: {
  title: string;
  input?: { brand?: string; mpn?: string; upc?: string; url?: string };
  expect: {
    chip: string;
    vramGb?: number | null;
    modelLine?: string | null;
    oc?: boolean;
    condition?: "new" | "open_box" | "refurb";
    minConfidence?: number;
  };
}[] = [
  {
    title:
      "MSI GeForce RTX 5070 Ti 16G VENTUS 3X PZ 16GB GDDR7 Graphics Card",
    input: { brand: "MSI" },
    expect: { chip: "rtx-5070-ti", vramGb: 16, modelLine: "ventus-3x", oc: false },
  },
  {
    title: "ZOTAC GAMING GeForce RTX 5060 AMP 8GB GDDR7",
    expect: { chip: "rtx-5060", vramGb: 8, modelLine: "amp" },
  },
  {
    title: "ASUS Dual GeForce RTX 5070 12GB GDDR7 OC Edition",
    expect: { chip: "rtx-5070", vramGb: 12, modelLine: "dual", oc: true },
  },
  {
    title: "Gigabyte GeForce RTX 5090 GAMING OC 32G",
    expect: { chip: "rtx-5090", vramGb: 32, modelLine: "gaming-oc", oc: true },
  },
  {
    title: "PNY NVIDIA GeForce RTX 5080 16GB",
    expect: { chip: "rtx-5080", vramGb: 16 },
  },
  {
    title: "Palit GeForce RTX 5050 StormX 8GB",
    expect: { chip: "rtx-5050", vramGb: 8, modelLine: "stormx" },
  },
  {
    title: "MSI RTX 5060 Ti 16G VENTUS 2X OC",
    expect: { chip: "rtx-5060-ti", vramGb: 16, modelLine: "ventus-2x", oc: true },
  },
  {
    title: "ASUS TUF Gaming GeForce RTX 4090 OC 24GB",
    expect: { chip: "rtx-4090", vramGb: 24, modelLine: "tuf", oc: true },
  },
  {
    title: "NVIDIA GeForce RTX 4080 SUPER Founders Edition 16GB",
    expect: { chip: "rtx-4080-super", vramGb: 16 },
  },
  {
    title: "Gigabyte RTX 4070 Ti SUPER Gaming OC 16G",
    expect: { chip: "rtx-4070-ti-super", vramGb: 16, modelLine: "gaming-oc", oc: true },
  },
  {
    title: "MSI GeForce RTX 4070 SUPER 12G VENTUS 2X",
    expect: { chip: "rtx-4070-super", vramGb: 12, modelLine: "ventus-2x" },
  },
  {
    title: "ZOTAC RTX 4070 Ti 12GB Trinity OC",
    expect: { chip: "rtx-4070-ti", vramGb: 12, modelLine: "trinity", oc: true },
  },
  {
    title: "ASUS ROG Strix RTX 4060 Ti OC 8GB GDDR6",
    expect: { chip: "rtx-4060-ti", vramGb: 8, modelLine: "rog-strix", oc: true },
  },
  {
    title: "MSI RTX 4060 VENTUS 2X BLACK 8G",
    expect: { chip: "rtx-4060", vramGb: 8, modelLine: "ventus-2x" },
  },
  {
    title: "EVGA GeForce RTX 3090 Ti FTW3 ULTRA 24GB",
    expect: { chip: "rtx-3090-ti", vramGb: 24 },
  },
  {
    title: "NVIDIA RTX 3090 Founders Edition 24G",
    expect: { chip: "rtx-3090", vramGb: 24 },
  },
  {
    title: "Gigabyte RTX 3080 Ti Gaming OC 12GB",
    expect: { chip: "rtx-3080-ti", vramGb: 12, modelLine: "gaming-oc", oc: true },
  },
  {
    title: "MSI GeForce RTX 3080 VENTUS 3X 10G OC",
    expect: { chip: "rtx-3080", vramGb: 10, modelLine: "ventus-3x", oc: true },
  },
  {
    title: "ASUS Dual RTX 3070 8GB",
    expect: { chip: "rtx-3070", vramGb: 8, modelLine: "dual" },
  },
  {
    title: "ZOTAC RTX 3070 Ti AMP Holo 8G",
    expect: { chip: "rtx-3070-ti", vramGb: 8, modelLine: "amp" },
  },
  {
    title: "MSI RTX 3060 Ti GAMING X 8GB",
    expect: { chip: "rtx-3060-ti", vramGb: 8, modelLine: "gaming-x" },
  },
  {
    title: "PNY RTX 3060 12GB XLR8",
    expect: { chip: "rtx-3060", vramGb: 12 },
  },
  {
    title: "MSI RTX 5070 Ti 16G — Open Box",
    input: { url: "https://example.com/openbox" },
    expect: { chip: "rtx-5070-ti", vramGb: 16, condition: "open_box" },
  },
  {
    title: "ASUS RTX 4070 Refurbished 12GB",
    expect: { chip: "rtx-4070", vramGb: 12, condition: "refurb" },
  },
  {
    title: "Gaming GPU with RGB fans 8GB",
    expect: { chip: "unknown-chip", minConfidence: 0, },
  },
  {
    title: "MSI GeForce RTX 5070 Ti 16G VENTUS 3X",
    input: { upc: "0824146234567" },
    expect: { chip: "rtx-5070-ti", vramGb: 16, modelLine: "ventus-3x", minConfidence: 0.85 },
  },
  {
    title: "ASUS PRIME RTX 5070 12GB",
    input: { mpn: "PRIME-RTX5070-12G" },
    expect: { chip: "rtx-5070", vramGb: 12, minConfidence: 0.75 },
  },
];

describe("normalizeGpu table", () => {
  it.each(CASES)("$title", ({ title, input, expect: exp }) => {
    const result = normalizeGpu(title, input);
    expect(result.key.chip).toBe(exp.chip);
    if (exp.vramGb !== undefined) {
      expect(result.key.vramGb).toBe(exp.vramGb);
    }
    if (exp.modelLine !== undefined) {
      expect(result.key.modelLine).toBe(exp.modelLine);
    }
    if (exp.oc !== undefined) {
      expect(result.key.oc).toBe(exp.oc);
    }
    if (exp.condition !== undefined) {
      expect(result.parsed.condition).toBe(exp.condition);
    }
    if (exp.minConfidence !== undefined) {
      expect(result.confidence).toBeGreaterThanOrEqual(exp.minConfidence);
    }
    expect(result.keyString).toContain(result.key.vendor);
  });
});

describe("matchOffers", () => {
  const base = (partial: Partial<Offer>): Offer => ({
    retailer: "Test",
    retailerSku: partial.retailerSku ?? "1",
    url: partial.url ?? "https://example.com/1",
    title: partial.title ?? "MSI RTX 5070 Ti 16G VENTUS 3X",
    priceCents: 99900,
    currency: "CAD",
    condition: "new",
    stockOnline: "in_stock",
    storeStock: [],
    fetchedAt: new Date().toISOString(),
    ...partial,
  });

  it("groups high-confidence offers and sends low-confidence to review", () => {
    const offers = [
      base({ retailerSku: "a", title: "MSI GeForce RTX 5070 Ti 16G VENTUS 3X OC", brand: "MSI" }),
      base({ retailerSku: "b", title: "MSI RTX 5070 Ti 16GB VENTUS 3X Overclocked", brand: "MSI" }),
      base({ retailerSku: "c", title: "Generic 8GB graphics adapter" }),
    ];
    const { groups, review } = matchOffers(offers);
    expect(review).toHaveLength(1);
    expect(review[0]!.retailerSku).toBe("c");
    expect(groups.length).toBeGreaterThanOrEqual(1);
  });
});