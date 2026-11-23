import type { FetchFn } from "./types.js";
import {
  isBlockedStatus,
  isBotChallenge,
  isRateLimitedStatus,
  isTransientServerError,
} from "./challenge.js";

const hostLastFetch = new Map<string, number>();

export async function waitForHost(
  host: string,
  minIntervalMs: number
): Promise<void> {
  const now = Date.now();
  const last = hostLastFetch.get(host) ?? 0;
  const wait = last + minIntervalMs - now;
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  hostLastFetch.set(host, Date.now());
}

export interface FetchHtmlOptions {
  fetch: FetchFn;
  userAgent: string;
  timeoutMs: number;
  minIntervalMs?: number;
}

export type FetchHtmlFailureOutcome =
  | "blocked"
  | "rate_limited"
  | "http_error"
  | "timeout";

export type FetchHtmlResult =
  | { ok: true; html: string; finalUrl: string; status: number }
  | {
      ok: false;
      outcome: FetchHtmlFailureOutcome;
      status?: number;
      message: string;
      html?: string;
    };

function isTimeoutError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "TimeoutError") ||
    (err instanceof Error && /timeout/i.test(err.message))
  );
}

export async function fetchHtml(
  url: string,
  options: FetchHtmlOptions
): Promise<FetchHtmlResult> {
  const u = new URL(url);
  const minMs = options.minIntervalMs ?? 7_000;

  const attemptOnce = async (): Promise<FetchHtmlResult> => {
    await waitForHost(u.host, minMs);
    try {
      const res = await options.fetch(url, {
        headers: {
          "User-Agent": options.userAgent,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      const html = await res.text();

      if (isRateLimitedStatus(res.status)) {
        return {
          ok: false,
          outcome: "rate_limited",
          status: res.status,
          message: `HTTP ${res.status} rate limited for ${url}`,
          html,
        };
      }
      if (
        isBlockedStatus(res.status) ||
        isBotChallenge(html, res.status)
      ) {
        return {
          ok: false,
          outcome: "blocked",
          status: res.status,
          message: `Blocked or challenge for ${url} (${res.status})`,
          html,
        };
      }
      if (!res.ok) {
        return {
          ok: false,
          outcome: "http_error",
          status: res.status,
          message: `HTTP ${res.status} for ${url}`,
          html,
        };
      }
      return { ok: true, html, finalUrl: res.url, status: res.status };
    } catch (err) {
      if (isTimeoutError(err)) {
        return {
          ok: false,
          outcome: "timeout",
          message: err instanceof Error ? err.message : "fetch timeout",
        };
      }
      throw err;
    }
  };

  const first = await attemptOnce();
  if (first.ok) return first;

  const retryable =
    first.outcome === "timeout" ||
    (first.outcome === "http_error" &&
      first.status != null &&
      isTransientServerError(first.status));

  if (!retryable) return first;

  const backoff = minMs;
  await new Promise((r) => setTimeout(r, backoff));
  const second = await attemptOnce();
  return second;
}