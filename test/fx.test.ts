import { describe, expect, it, vi } from "vitest";
import { clearFxCache, getFxRate } from "../src/fx.js";

describe("getFxRate", () => {
  it("caches USD/CAD from Bank of Canada shape", async () => {
    clearFxCache();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        observations: [{ FXUSDCAD: { v: "1.39" } }],
      }),
    });
    const rate = await getFxRate("USD", "CAD", mockFetch as typeof fetch);
    expect(rate).toBe(1.39);
    const again = await getFxRate("USD", "CAD", mockFetch as typeof fetch);
    expect(again).toBe(1.39);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("inverts CAD to USD", async () => {
    clearFxCache();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        observations: [{ FXUSDCAD: { v: "1.40" } }],
      }),
    });
    const rate = await getFxRate("CAD", "USD", mockFetch as typeof fetch);
    expect(rate).toBeCloseTo(1 / 1.4, 5);
  });
});