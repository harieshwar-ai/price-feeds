import { createAdapter, listSources } from "./registry.js";
import type {
  FetchFn,
  PriceFeedsClient,
  PriceFeedsClientOptions,
  SourceAdapter,
} from "./types.js";

export const DEFAULT_USER_AGENT =
  "PriceFeedsBot/0.1 (+https://github.com/harieshwar-ai/price-feeds)";

export const DEFAULT_TIMEOUT_MS = 20_000;

export function createClient(
  options: PriceFeedsClientOptions = {}
): PriceFeedsClient {
  const fetchFn: FetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const ctx = { fetch: fetchFn, userAgent, timeoutMs };

  return {
    listSources: () => listSources(),
    getAdapter(id: string): SourceAdapter {
      return createAdapter(id, ctx);
    },
  };
}

/** Convenience: `getAdapter` without constructing a long-lived client. */
export function getAdapter(
  id: string,
  options: PriceFeedsClientOptions = {}
): SourceAdapter {
  return createClient(options).getAdapter(id);
}