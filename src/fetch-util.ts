import type { FetchFn } from "./types.js";

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

export async function fetchHtml(
  url: string,
  options: FetchHtmlOptions
): Promise<{ html: string; finalUrl: string; status: number }> {
  const u = new URL(url);
  const minMs = options.minIntervalMs ?? 7_000;
  await waitForHost(u.host, minMs);

  const res = await options.fetch(url, {
    headers: {
      "User-Agent": options.userAgent,
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(options.timeoutMs),
  });

  const html = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return { html, finalUrl: res.url, status: res.status };
}