import { describe, expect, it } from "vitest";
import { createClient, getAdapter } from "../src/client.js";
import { assertSourceCleared } from "../src/registry.js";

describe("cleared-sources registry", () => {
  it("returns Canada Computers adapter when cleared", () => {
    const adapter = getAdapter("canadacomputers");
    expect(adapter.id).toBe("canadacomputers");
    expect(adapter.clearance).toBe("cleared_page");
  });

  it.each(["memoryexpress", "bestbuy-ca", "amazon-ca"])(
    "throws for non-cleared source %s",
    (id) => {
      expect(() => createClient().getAdapter(id)).toThrow(/not cleared/);
      expect(() => getAdapter(id)).toThrow(/not cleared/);
    }
  );

  it("assertSourceCleared throws for unknown id", () => {
    expect(() => assertSourceCleared("not-a-store")).toThrow(/Unknown source/);
  });
});