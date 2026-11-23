import { fetchHtml } from "../fetch-util.js";
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
const SEARCH_URL =
  "https://www.canadacomputers.com/search/index.php?search=";

export function createCanadaComputersAdapter(
  ctx: AdapterContext
): SourceAdapter {
  let fetchesThisRun = 0;

  const guardBudget = () => {
    if (fetchesThisRun >= MAX_PER_RUN) {
      throw new Error(
        `Canada Computers adapter: maxPerRun (${MAX_PER_RUN}) exceeded`
      );
    }
    fetchesThisRun += 1;
  };

  const htmlToOffer = (html: string, finalUrl: string): Offer => {
    const parsed = parseCanadaComputersProductHtml(html, finalUrl);
    if (!parsed || parsed.priceCad == null) {
      throw new Error(`Failed to parse Canada Computers listing at ${finalUrl}`);
    }
    return {
      retailer: RETAILER,
      retailerSku: parsed.sku,
      url: finalUrl,
      title: parsed.title,
      brand: parsed.brand,
      mpn: parsed.mpn,
      priceCents: Math.round(parsed.priceCad * 100),
      currency: "CAD",
      condition: parsed.condition,
      stockOnline: parsed.stockOnline,
      storeStock: parsed.storeStock,
      fetchedAt: new Date().toISOString(),
    };
  };

  return {
    id: "canadacomputers",
    retailer: RETAILER,
    country: "CA",
    currency: "CAD",
    clearance: "cleared_page",
    rateLimit: { minIntervalMs: MIN_INTERVAL_MS, maxPerRun: MAX_PER_RUN },

    async search(query: string, opts?: SearchOptions): Promise<Offer[]> {
      const limit = opts?.limit ?? 5;
      guardBudget();
      const searchUrl =
        SEARCH_URL + encodeURIComponent(query.trim());
      const { html } = await fetchHtml(searchUrl, {
        fetch: ctx.fetch,
        userAgent: ctx.userAgent,
        timeoutMs: ctx.timeoutMs,
        minIntervalMs: MIN_INTERVAL_MS,
      });
      const productUrls = parseCanadaComputersSearchHtml(
        html,
        searchUrl,
        limit
      );
      const offers: Offer[] = [];
      for (const productUrl of productUrls) {
        if (fetchesThisRun >= MAX_PER_RUN) break;
        guardBudget();
        const { html: pHtml, finalUrl } = await fetchHtml(productUrl, {
          fetch: ctx.fetch,
          userAgent: ctx.userAgent,
          timeoutMs: ctx.timeoutMs,
          minIntervalMs: MIN_INTERVAL_MS,
        });
        try {
          offers.push(htmlToOffer(pHtml, finalUrl));
        } catch {
          /* skip unparseable hits */
        }
      }
      return offers;
    },

    async fetchListing(
      urlOrSku: string,
      opts?: FetchListingOptions
    ): Promise<Offer> {
      guardBudget();
      const url = resolveCanadaComputersFetchUrl(urlOrSku);
      const timeoutMs = opts?.timeoutMs ?? ctx.timeoutMs;
      const { html, finalUrl } = await fetchHtml(url, {
        fetch: ctx.fetch,
        userAgent: ctx.userAgent,
        timeoutMs,
        minIntervalMs: MIN_INTERVAL_MS,
      });
      return htmlToOffer(html, finalUrl);
    },
  };
}