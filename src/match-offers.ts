import type { Offer, OfferCondition, SellerType } from "./types.js";
import { offerGroupKey, resolveProductIdentity } from "./product/identity.js";

export interface MatchedOfferGroup {
  productKey: string;
  groupKey: string;
  condition: OfferCondition;
  sellerType: SellerType;
  offers: Offer[];
  confirmed: boolean;
}

export interface MatchOffersResult {
  groups: MatchedOfferGroup[];
  /** Title-only proposals (no UPC/MPN confirmation). */
  review: Offer[];
  /** Marketplace / third-party prices suspiciously below legit floor. */
  unconfirmed: Offer[];
}

const DEFAULT_SOURCE_ID = "unknown";

function sellerType(offer: Offer): SellerType {
  return offer.sellerType ?? "first_party";
}

function isLegitFloorCandidate(offer: Offer): boolean {
  return (
    sellerType(offer) === "first_party" &&
    offer.condition === "new" &&
    !offer.unconfirmedPrice
  );
}

export interface MatchOffersOptions {
  sourceIdByRetailer?: Record<string, string>;
  /** Fraction below cheapest legit offer to flag marketplace (default 0.5). */
  deepDiscountThreshold?: number;
}

export function matchOffers(
  offers: Offer[],
  options: MatchOffersOptions = {}
): MatchOffersResult {
  const threshold = options.deepDiscountThreshold ?? 0.5;
  const groups = new Map<string, MatchedOfferGroup>();
  const review: Offer[] = [];

  const withFlags = offers.map((o) => ({ ...o }));

  const legitPrices = withFlags
    .filter(isLegitFloorCandidate)
    .map((o) => o.priceCents);
  const floor = legitPrices.length ? Math.min(...legitPrices) : null;

  const unconfirmed: Offer[] = [];
  for (const offer of withFlags) {
    if (
      floor != null &&
      sellerType(offer) === "marketplace" &&
      offer.priceCents < floor * (1 - threshold)
    ) {
      offer.unconfirmedPrice = true;
      unconfirmed.push(offer);
    }
  }

  for (const offer of withFlags) {
    const sourceId =
      offer.sourceId ??
      options.sourceIdByRetailer?.[offer.retailer] ??
      DEFAULT_SOURCE_ID;

    const identity = resolveProductIdentity({
      title: offer.title,
      brand: offer.brand,
      mpn: offer.mpn,
      upc: offer.upc,
      sourceId,
      retailerPartNumber: offer.retailerSku,
      url: offer.url,
    });

    if (!identity.confirmed) {
      review.push(offer);
      continue;
    }

    const cond = offer.condition;
    const seller = sellerType(offer);
    const gKey = offerGroupKey(identity.productKey, cond, seller);

    const existing = groups.get(gKey);
    if (existing) {
      existing.offers.push(offer);
    } else {
      groups.set(gKey, {
        productKey: identity.productKey,
        groupKey: gKey,
        condition: cond,
        sellerType: seller,
        offers: [offer],
        confirmed: true,
      });
    }
  }

  return {
    groups: [...groups.values()],
    review,
    unconfirmed,
  };
}