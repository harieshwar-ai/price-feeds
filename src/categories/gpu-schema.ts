import type { GpuCanonicalKey } from "../normalize/gpu.js";

/** Category-specific spec fields for GPU retail offers. */
export interface GpuOfferSpec {
  category: "gpu";
  canonical: GpuCanonicalKey;
  interfaceType?: "pcie";
  memoryType?: "gddr6" | "gddr6x" | "gddr7";
  powerWatts?: number;
}

export const GPU_CATEGORY_ID = "gpu" as const;

export type CommodityCategoryId = typeof GPU_CATEGORY_ID;
// Future: "cpu" | "ssd" | "ram"