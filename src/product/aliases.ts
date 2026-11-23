/**
 * Canonical product identity: MPN is primary; UPCs and per-retailer SKUs are aliases.
 * Extend this table as products are confirmed in production ingest.
 */
export interface ProductAliasRecord {
  /** Canonical manufacturer part number (normalized casing). */
  mpn: string;
  upcs: string[];
  /** sourceId → retailer part number */
  retailerPartNumbers: Record<string, string>;
}

/** Starter set — real cards from cleared Canada Computers listings. */
const ALIASES: ProductAliasRecord[] = [
  {
    mpn: "RTX 5070 Ti 16G VENTUS 3X PZ OC",
    upcs: ["824142448151"],
    retailerPartNumbers: {
      canadacomputers: "VCMSI00514",
    },
  },
];

const BY_MPN = new Map<string, ProductAliasRecord>();
const BY_UPC = new Map<string, ProductAliasRecord>();
const BY_RETAILER_PN = new Map<string, ProductAliasRecord>();

function normMpn(v: string): string {
  return v.trim().replace(/\s+/g, " ");
}

function normUpc(v: string): string {
  return v.replace(/\D/g, "");
}

for (const row of ALIASES) {
  const key = normMpn(row.mpn).toLowerCase();
  BY_MPN.set(key, row);
  for (const upc of row.upcs) {
    BY_UPC.set(normUpc(upc), row);
  }
  for (const [sourceId, pn] of Object.entries(row.retailerPartNumbers)) {
    BY_RETAILER_PN.set(`${sourceId}::${pn}`.toLowerCase(), row);
  }
}

export function lookupByMpn(mpn: string): ProductAliasRecord | null {
  return BY_MPN.get(normMpn(mpn).toLowerCase()) ?? null;
}

export function lookupByUpc(upc: string): ProductAliasRecord | null {
  return BY_UPC.get(normUpc(upc)) ?? null;
}

export function lookupByRetailerPartNumber(
  sourceId: string,
  partNumber: string
): ProductAliasRecord | null {
  return (
    BY_RETAILER_PN.get(`${sourceId}::${partNumber}`.toLowerCase()) ?? null
  );
}

/** Stable product identity string (condition and seller are excluded). */
export function productKeyFromAlias(record: ProductAliasRecord): string {
  return `mpn:${normMpn(record.mpn).toLowerCase()}`;
}

export function resolveProductAlias(input: {
  mpn?: string;
  upc?: string;
  sourceId?: string;
  retailerPartNumber?: string;
}): ProductAliasRecord | null {
  if (input.mpn) {
    const hit = lookupByMpn(input.mpn);
    if (hit) return hit;
  }
  if (input.upc) {
    const hit = lookupByUpc(input.upc);
    if (hit) return hit;
  }
  if (input.sourceId && input.retailerPartNumber) {
    return lookupByRetailerPartNumber(
      input.sourceId,
      input.retailerPartNumber
    );
  }
  return null;
}