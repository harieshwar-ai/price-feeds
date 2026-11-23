import { describe, expect, it } from "vitest";
import { normalizeGpu, parseCompactMpnFragment } from "../src/normalize/gpu.js";

describe("spaceless MPN fragments", () => {
  it.each([
    ["RTX5070TI16GMTO", "rtx-5070-ti", 16],
    ["RTX507016GVENTUS", "rtx-5070", 16],
    ["RTX409024GSUPRIM", "rtx-4090", 24],
  ] as const)("compact %s", (mpn, chip, vram) => {
    const compact = parseCompactMpnFragment(mpn);
    expect(compact.chip).toBe(chip);
    expect(compact.vramGb).toBe(vram);
    const norm = normalizeGpu("MSI Graphics Card", { mpn });
    expect(norm.key.chip).toBe(chip);
    expect(norm.key.vramGb).toBe(vram);
  });
});

describe("distinct model lines", () => {
  it.each([
    ["MSI GeForce RTX 5070 Ti 16G VENTUS 3X PZ OC", "ventus-3x-pz"],
    ["MSI GeForce RTX 5070 Ti 16G VENTUS 3X OC", "ventus-3x"],
    ["MSI GeForce RTX 5090 32G GAMING TRIO", "gaming-trio"],
    ["ZOTAC GAMING GeForce RTX 5080 AMP EXTREME 16GB", "amp-extreme"],
    ["ZOTAC GAMING GeForce RTX 5060 AMP 8GB", "amp"],
  ] as const)("%s → %s", (title, line) => {
    expect(normalizeGpu(title).key.modelLine).toBe(line);
  });
});

describe("high VRAM capacities", () => {
  it.each([
    ["NVIDIA RTX PRO 6000 96GB GDDR7 Workstation", 96],
    ["MSI RTX 5090 32GB GAMING TRIO", 32],
    ["ASUS RTX 4060 8 GB", 8],
  ] as const)("%s", (title, vram) => {
    expect(normalizeGpu(title).key.vramGb).toBe(vram);
  });
});