import { fetchHtml } from "../fetch-util.js";
import type { AdapterResult } from "../adapter-result.js";
import { createSourceHealth } from "../adapter-result.js";
import type {
  AdapterContext,
  Offer,
  SearchOptions,
  SourceAdapter,
  FetchListingOptions,
} from "../types.js";
import {
  parseCanadaComputersProductHtml,
  parseCanadaComputersSearchHtml,
  resolveCanadaComputersFetchUrl,
} from "./canada-computers-parse.js";

const MIN_INTERVAL_MS = 7_000;
const MAX_PER_RUN = 8;
const RETAILER = "Canada Computers";
const SOURCE_ID = "canadacomputers";
const SEARCH_URL =
  "https://www.canadacomputers.com/search/index.php?search=";

let fetchSeq = 0;

function nextFetchId(): string {
  fetchSeq += 1;
  return `${SOURCE_ID}-${Date.now()}-${fetchSeq}`;
}

export function createCanadaComputersAdapter(
  ctx: AdapterContext
): SourceAdapter {
  let fetchesThisRun = 0;
  const health = createSourceHealth(SOURCE_ID);

  const stopped = () => health.stoppedForRun;

  const guardBudget = (): AdapterResult<never> | null => {
    if (stopped()) {
      return {
        outcome: "blocked",
        message: health.lastMessage ?? "Source stopped for this run",
      };
    }
    if (fetchesThisRun >= MAX_PER_RUN) {
      health.stop("max_per_run", "maxPerRun exceeded", "rate_limited");
      return { outcome: "rate_limited", message: "maxPerRun exceeded" };
    }
    fetchesThisRun += 1;
    health.recordAttempt();
    return null;
  };

  const mapFetchFailure = (
    url: string,
    result: Extract<Awaited<ReturnType<typeof fetchHtml>>, { ok: false }>
  ): AdapterResult<never> => {
    if (result.outcome === "blocked") {
      health.stop("blocked", result.message, "blocked");
      return {
        outcome: "blocked",
        message: result.message,
        httpStatus: result.status,
      };
    }
    if (result.outcome === "rate_limited") {
      health.stop("rate_limited", result.message, "rate_limited");
      return {
        outcome: "rate_limited",
        message: result.message,
        httpStatus: result.status,
      };
    }
    if (result.status === 404) {
      return { outcome: "not_found", message: result.message, url };
    }
    return { outcome: "parse_error", message: result.message, url };
  };

  const htmlToOffer = (html: string, finalUrl: string): Offer | null => {
    const parsed = parseCanadaComputersProductHtml(html, finalUrl);
    if (!parsed || parsed.priceCad == null) return null;
    return {
      retailer: RETAILER,
      retailerSku: parsed.sku,
      url: finalUrl,
      title: parsed.title,
      brand: parsed.brand,
      mpn: parsed.mpn,
      upc: parsed.upc,
      priceCents: Math.round(parsed.priceCad * 100),
      currency: "CAD",
      condition: parsed.condition,
      stockOnline: parsed.stockOnline,
      storeStock: parsed.storeStock,
      fetchedAt: new Date().toISOString(),
      sellerType: "first_party",
      sourceId: SOURCE_ID,
      fetchId: nextFetchId(),
    };
  };

  return {
    id: SOURCE_ID,
    retailer: RETAILER,
    country: "CA",
    currency: "CAD",
    clearance: "cleared_page",
    rateLimit: { minIntervalMs: MIN_INTERVAL_MS, maxPerRun: MAX_PER_RUN },

    getHealth() {
      return { ...health };
    },

    async search(query: string, opts?: SearchOptions): Promise<AdapterResult<Offer[]>> {
      const limit = opts?.limit ?? 5;
      const budget = guardBudget();
      if (budget) return budget;

      const searchUrl = SEARCH_URL + encodeURIComponent(query.trim());
      const searchRes = await fetchHtml(searchUrl, {
        fetch: ctx.fetch,
        userAgent: ctx.userAgent,
        timeoutMs: ctx.timeoutMs,
        minIntervalMs: MIN_INTERVAL_MS,
      });
      if (!searchRes.ok) return mapFetchFailure(searchUrl, searchRes);

      const productUrls = parseCanadaComputersSearchHtml(
        searchRes.html,
        searchUrl,
        limit
      );
      const offers: Offer[] = [];
      for (const productUrl of productUrls) {
        if (stopped()) break;
        const budgetInner = guardBudget();
        if (budgetInner) break;
        const res = await fetchHtml(productUrl, {
          fetch: ctx.fetch,
          userAgent: ctx.userAgent,
          timeoutMs: ctx.timeoutMs,
          minIntervalMs: MIN_INTERVAL_MS,
        });
        if (!res.ok) {
          const fail = mapFetchFailure(productUrl, res);
          if (fail.outcome === "blocked" || fail.outcome === "rate_limited") {
            return fail;
          }
          continue;
        }
        const offer = htmlToOffer(res.html, res.finalUrl);
        if (offer) {
          offers.push(offer);
          health.recordOk();
        }
      }
      if (offers.length) health.recordOk();
      return { outcome: "ok", data: offers };
    },

    async fetchListing(
      urlOrSku: string,
      opts?: FetchListingOptions
    ): Promise<AdapterResult<Offer>> {
      const budget = guardBudget();
      if (budget) return budget;

      const url = resolveCanadaComputersFetchUrl(urlOrSku);
      const timeoutMs = opts?.timeoutMs ?? ctx.timeoutMs;
      const res = await fetchHtml(url, {
        fetch: ctx.fetch,
        userAgent: ctx.userAgent,
        timeoutMs,
        minIntervalMs: MIN_INTERVAL_MS,
      });
      if (!res.ok) return mapFetchFailure(url, res);

      const offer = htmlToOffer(res.html, res.finalUrl);
      if (!offer) {
        if (/pagenotfound/i.test(res.html)) {
          return { outcome: "not_found", message: "Product not found", url: res.finalUrl };
        }
        return {
          outcome: "parse_error",
          message: "Failed to parse product page",
          url: res.finalUrl,
        };
      }
      health.recordOk();
      return { outcome: "ok", data: offer };
    },
  };
}