import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseCanadaComputersProductHtml } from "../src/adapters/canada-computers-parse.js";

const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures/canadacomputers-rtx-5070-ti-282429.html"
);

const FIXTURE_URL =
  "https://www.canadacomputers.com/en/powered-by-nvidia/282429/msi-geforce-rtx-5070-ti-16g-ventus-3x-pz-16gb-gddr7-graphics-card-rtx-5070-ti-16g-ventus-3x-pz-oc.html";

describe("parseCanadaComputersProductHtml (fixture)", () => {
  it("parses RTX 5070 Ti fixture with price, online stock, and store rows", () => {
    const html = readFileSync(FIXTURE, "utf8");
    const parsed = parseCanadaComputersProductHtml(html, FIXTURE_URL);
    expect(parsed).not.toBeNull();
    expect(parsed!.sku).toBeTruthy();
    expect(
      parsed!.sku === "282429" || parsed!.sku === "VCMSI00514"
    ).toBe(true);
    expect(parsed!.brand).toMatch(/msi/i);
    expect(parsed!.title.toLowerCase()).toContain("rtx 5070");
    expect(parsed!.priceCad).not.toBeNull();
    expect(parsed!.priceCad!).toBeGreaterThan(100);
    expect(["in_stock", "out_of_stock", "unknown"]).toContain(
      parsed!.stockOnline
    );
    expect(parsed!.condition).toBe("new");
    expect(parsed!.storeStock.length).toBeGreaterThan(0);
    expect(parsed!.storeStock[0]!.storeId).toMatch(/^cc-/);
  });
});

describe("open-box detection", () => {
  it("flags open box from title", () => {
    const html = `<html><body><h1 class="product-title">MSI RTX 5070 Open Box</h1>
      <span id="delivery-text">In stock online</span>
      <span class="current-price-value">$599.99</span></body></html>`;
    const parsed = parseCanadaComputersProductHtml(
      html,
      "https://www.canadacomputers.com/openbox/test.html"
    );
    expect(parsed?.condition).toBe("open_box");
  });
});