import type { Offer } from "./types.js";
import { normalizeGpu, type NormalizeGpuInput } from "./normalize/gpu.js";

export interface MatchedOfferGroup {
  keyString: string;
  offers: Offer[];
  confidence: number;
}

export interface MatchOffersResult {
  groups: MatchedOfferGroup[];
  review: Offer[];
}

export function matchOffers(
  offers: Offer[],
  extraBySku?: Record<string, NormalizeGpuInput>
): MatchOffersResult {
  const groups = new Map<string, MatchedOfferGroup>();
  const review: Offer[] = [];

  for (const offer of offers) {
    const extra = extraBySku?.[offer.retailerSku] ?? {};
    const norm = normalizeGpu(offer.title, {
      brand: offer.brand ?? extra.brand,
      mpn: offer.mpn ?? extra.mpn,
      upc: offer.upc ?? extra.upc,
      url: offer.url ?? extra.url,
    });

    if (norm.confidence < 0.7) {
      review.push(offer);
      continue;
    }

    const existing = groups.get(norm.keyString);
    if (existing) {
      existing.offers.push(offer);
      existing.confidence = Math.max(existing.confidence, norm.confidence);
    } else {
      groups.set(norm.keyString, {
        keyString: norm.keyString,
        offers: [offer],
        confidence: norm.confidence,
      });
    }
  }

  return {
    groups: [...groups.values()],
    review,
  };
}