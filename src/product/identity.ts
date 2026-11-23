import { buildGpuKeyString, normalizeGpu } from "../normalize/gpu.js";
import {
  productKeyFromAlias,
  resolveProductAlias,
} from "./aliases.js";

export interface ProductIdentity {
  productKey: string;
  /** True when identity is backed by UPC, MPN, or known alias — not title-only. */
  confirmed: boolean;
  canonicalMpn?: string;
}

export function resolveProductIdentity(input: {
  title: string;
  brand?: string;
  mpn?: string;
  upc?: string;
  sourceId?: string;
  retailerPartNumber?: string;
  url?: string;
}): ProductIdentity {
  const alias = resolveProductAlias({
    mpn: input.mpn,
    upc: input.upc,
    sourceId: input.sourceId,
    retailerPartNumber: input.retailerPartNumber,
  });
  if (alias) {
    return {
      productKey: productKeyFromAlias(alias),
      confirmed: true,
      canonicalMpn: alias.mpn,
    };
  }

  const hasIdentifier = Boolean(input.mpn?.trim() || input.upc?.trim());
  const norm = normalizeGpu(input.title, {
    brand: input.brand,
    mpn: input.mpn,
    upc: input.upc,
    url: input.url,
  });

  if (hasIdentifier) {
    const mpnPart = input.mpn?.trim().toLowerCase().replace(/\s+/g, "-") ?? "no-mpn";
    const upcPart = input.upc?.replace(/\D/g, "") ?? "no-upc";
    return {
      productKey: `${buildGpuKeyString(norm.key)}|mpn:${mpnPart}|upc:${upcPart}`,
      confirmed: true,
      canonicalMpn: input.mpn,
    };
  }

  return {
    productKey: `proposed:${buildGpuKeyString(norm.key)}`,
    confirmed: false,
  };
}

/** Grouping key: product identity + condition + seller (never merge conditions). */
export function offerGroupKey(
  productKey: string,
  condition: string,
  sellerType: string
): string {
  return `${productKey}::${condition}::${sellerType}`;
}