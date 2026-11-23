const BOE_URL =
  "https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=1";

interface FxCacheEntry {
  rate: number;
  fetchedAt: number;
}

const cache = new Map<string, FxCacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000;

function pairKey(from: string, to: string): string {
  return `${from.toUpperCase()}:${to.toUpperCase()}`;
}

/**
 * Display conversion only. Prices in offers remain in native currency.
 */
export async function getFxRate(
  from: string,
  to: string,
  fetchFn: typeof globalThis.fetch = globalThis.fetch
): Promise<number> {
  const fromU = from.toUpperCase();
  const toU = to.toUpperCase();
  if (fromU === toU) return 1;

  const direct = pairKey(fromU, toU);
  const cached = cache.get(direct);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rate;
  }

  if (fromU === "USD" && toU === "CAD") {
    const res = await fetchFn(BOE_URL, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new Error(`Bank of Canada FX API HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      observations?: { FXUSDCAD?: { v?: string } }[];
    };
    const obs = data.observations?.[0]?.FXUSDCAD?.v;
    const rate = obs ? Number.parseFloat(obs) : NaN;
    if (!Number.isFinite(rate)) {
      throw new Error("Bank of Canada FX API returned no FXUSDCAD rate");
    }
    cache.set(direct, { rate, fetchedAt: Date.now() });
    cache.set(pairKey(toU, fromU), { rate: 1 / rate, fetchedAt: Date.now() });
    return rate;
  }

  if (fromU === "CAD" && toU === "USD") {
    const usdCad = await getFxRate("USD", "CAD", fetchFn);
    return 1 / usdCad;
  }

  throw new Error(`FX pair not supported: ${fromU} → ${toU}`);
}

/** @internal test helper */
export function clearFxCache(): void {
  cache.clear();
}