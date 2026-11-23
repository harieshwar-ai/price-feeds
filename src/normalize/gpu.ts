import { detectOpenBox } from "../adapters/canada-computers-parse.js";

export interface NormalizeGpuInput {
  brand?: string;
  mpn?: string;
  upc?: string;
  url?: string;
}

export interface GpuCanonicalKey {
  vendor: string;
  chip: string;
  vramGb: number | null;
  modelLine: string | null;
  oc: boolean;
}

export interface NormalizeGpuResult {
  key: GpuCanonicalKey;
  /** Stable string for product identity (excludes condition and seller). */
  keyString: string;
  parsed: GpuCanonicalKey & {
    condition: "new" | "open_box" | "refurb" | "used";
    isSuper: boolean;
    isTi: boolean;
  };
  /** Title-only confidence; identifiers are confirmed via {@link resolveProductIdentity}. */
  confidence: number;
}

const CHIP_PATTERNS: { re: RegExp; chip: string }[] = [
  { re: /\bRTX\s*PRO\s*6000\b/i, chip: "rtx-pro-6000" },
  { re: /\bRTX\s*PRO\s*5000\b/i, chip: "rtx-pro-5000" },
  { re: /\bRTX\s*5090\b/i, chip: "rtx-5090" },
  { re: /\bRTX\s*5080\b/i, chip: "rtx-5080" },
  { re: /\bRTX\s*5070\s*TI\b/i, chip: "rtx-5070-ti" },
  { re: /\bRTX\s*5070\b/i, chip: "rtx-5070" },
  { re: /\bRTX\s*5060\s*TI\b/i, chip: "rtx-5060-ti" },
  { re: /\bRTX\s*5060\b/i, chip: "rtx-5060" },
  { re: /\bRTX\s*5050\b/i, chip: "rtx-5050" },
  { re: /\bRTX\s*4090\s*SUPER\b/i, chip: "rtx-4090-super" },
  { re: /\bRTX\s*4090\b/i, chip: "rtx-4090" },
  { re: /\bRTX\s*4080\s*SUPER\b/i, chip: "rtx-4080-super" },
  { re: /\bRTX\s*4080\b/i, chip: "rtx-4080" },
  { re: /\bRTX\s*4070\s*TI\s*SUPER\b/i, chip: "rtx-4070-ti-super" },
  { re: /\bRTX\s*4070\s*SUPER\b/i, chip: "rtx-4070-super" },
  { re: /\bRTX\s*4070\s*TI\b/i, chip: "rtx-4070-ti" },
  { re: /\bRTX\s*4070\b/i, chip: "rtx-4070" },
  { re: /\bRTX\s*4060\s*TI\b/i, chip: "rtx-4060-ti" },
  { re: /\bRTX\s*4060\b/i, chip: "rtx-4060" },
  { re: /\bRTX\s*3090\s*TI\b/i, chip: "rtx-3090-ti" },
  { re: /\bRTX\s*3090\b/i, chip: "rtx-3090" },
  { re: /\bRTX\s*3080\s*TI\b/i, chip: "rtx-3080-ti" },
  { re: /\bRTX\s*3080\b/i, chip: "rtx-3080" },
  { re: /\bRTX\s*3070\s*TI\b/i, chip: "rtx-3070-ti" },
  { re: /\bRTX\s*3070\b/i, chip: "rtx-3070" },
  { re: /\bRTX\s*3060\s*TI\b/i, chip: "rtx-3060-ti" },
  { re: /\bRTX\s*3060\b/i, chip: "rtx-3060" },
];

/** Longer / more specific lines must precede shorter prefixes. */
const MODEL_LINE_PATTERNS: { re: RegExp; line: string }[] = [
  { re: /\bventus\s*3x\s*pz\b/i, line: "ventus-3x-pz" },
  { re: /\bventus\s*3x\b/i, line: "ventus-3x" },
  { re: /\bventus\s*2x\b/i, line: "ventus-2x" },
  { re: /\bgaming\s*trio\b/i, line: "gaming-trio" },
  { re: /\bgaming\s*trinity\b/i, line: "gaming-trinity" },
  { re: /\btrinity\b/i, line: "trinity" },
  { re: /\bamp\s*extreme\b/i, line: "amp-extreme" },
  { re: /\bamp\b/i, line: "amp" },
  { re: /\bgaming\s*x\b/i, line: "gaming-x" },
  { re: /\bgaming\s*oc\b/i, line: "gaming-oc" },
  { re: /\bdual\s*oc\b/i, line: "dual-oc" },
  { re: /\bdual\b/i, line: "dual" },
  { re: /\btwin\s*edge\b/i, line: "twin-edge" },
  { re: /\bphantom\b/i, line: "phantom" },
  { re: /\bstormx\b/i, line: "stormx" },
  { re: /\bwindforce\b/i, line: "windforce" },
  { re: /\baorus\b/i, line: "aorus" },
  { re: /\brog\s*strix\b/i, line: "rog-strix" },
  { re: /\btuf\b/i, line: "tuf" },
  { re: /\bsuprim\b/i, line: "suprim" },
];

const VENDOR_FROM_BRAND: Record<string, string> = {
  msi: "msi",
  asus: "asus",
  gigabyte: "gigabyte",
  zotac: "zotac",
  pny: "pny",
  palit: "palit",
  evga: "evga",
  nvidia: "nvidia",
  asrock: "asrock",
  powercolor: "powercolor",
  gainward: "gainward",
};

/** Compact MPN strings without spaces (e.g. RTX5070TI16GMTO). */
const COMPACT_CHIP_RE =
  /RTX\s*(\d{4})(TI|SUPER)?\s*(\d{2,3})\s*G(?:B)?(?![A-Z0-9])/i;

const COMPACT_CHIP_NOSPACE_RE =
  /RTX(\d{4})(TI|SUPER)?(\d{2,3})G/i;

export function parseCompactMpnFragment(mpn: string): {
  chip: string | null;
  vramGb: number | null;
} {
  const compact = mpn.replace(/\s+/g, "");
  const m = compact.match(COMPACT_CHIP_NOSPACE_RE);
  if (!m) return { chip: null, vramGb: null };
  const series = m[1]!;
  const variant = (m[2] ?? "").toLowerCase();
  const vram = Number.parseInt(m[3]!, 10);
  let slug = `rtx-${series}`;
  if (variant === "ti") slug += "-ti";
  else if (variant === "super") slug += "-super";
  return {
    chip: slug,
    vramGb: Number.isFinite(vram) ? vram : null,
  };
}

function matchChip(text: string): string | null {
  for (const { re, chip } of CHIP_PATTERNS) {
    if (re.test(text)) return chip;
  }
  const compact = text.match(COMPACT_CHIP_RE) ?? text.replace(/\s+/g, "").match(COMPACT_CHIP_NOSPACE_RE);
  if (compact) {
    const series = compact[1]!;
    const variant = (compact[2] ?? "").toLowerCase();
    let slug = `rtx-${series}`;
    if (variant === "ti") slug += "-ti";
    else if (variant === "super") slug += "-super";
    return slug;
  }
  return null;
}

function parseVramGb(text: string): number | null {
  const compact = parseCompactMpnFragment(text);
  if (compact.vramGb != null) return compact.vramGb;

  const patterns = [
    /\b(\d{2,3})\s*(?:gb|g)\b/i,
    /\b(\d{2,3})g\s*gddr/i,
    /\b(\d{2,3})gb\s*gddr/i,
    /\b(\d{1,2})\s*(?:gb|g)\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const n = Number.parseInt(m[1]!, 10);
    if (Number.isFinite(n) && n >= 4 && n <= 128) return n;
  }
  return null;
}

function parseModelLine(text: string): string | null {
  for (const { re, line } of MODEL_LINE_PATTERNS) {
    if (re.test(text)) return line;
  }
  return null;
}

function parseVendor(text: string, brand?: string): string {
  const fromBrand = brand?.toLowerCase().trim();
  if (fromBrand && VENDOR_FROM_BRAND[fromBrand]) {
    return VENDOR_FROM_BRAND[fromBrand]!;
  }
  for (const [name, vendor] of Object.entries(VENDOR_FROM_BRAND)) {
    const re = new RegExp(`\\b${name}\\b`, "i");
    if (re.test(text)) return vendor;
  }
  if (/\bgeforce\b/i.test(text)) return "nvidia";
  return "unknown";
}

export function conditionFromTitle(
  title: string,
  url?: string
): "new" | "open_box" | "refurb" | "used" {
  if (detectOpenBox(title, url)) return "open_box";
  if (/\brefurb/i.test(title)) return "refurb";
  if (/\bused\b/i.test(title)) return "used";
  return "new";
}

export function buildGpuKeyString(key: GpuCanonicalKey): string {
  return [
    key.vendor,
    key.chip,
    key.vramGb != null ? `${key.vramGb}gb` : "unknown-vram",
    key.modelLine ?? "unknown-line",
    key.oc ? "oc" : "stock",
  ].join("|");
}

export function normalizeGpu(
  title: string,
  input: NormalizeGpuInput = {}
): NormalizeGpuResult {
  const text = [title, input.mpn, input.upc].filter(Boolean).join(" ");
  const chip = matchChip(text);
  const vendor = parseVendor(title, input.brand);
  const vramGb = parseVramGb(text);
  const modelLine = parseModelLine(text);
  const oc = /\boc\b/i.test(text) || /\boverclock/i.test(text) || /mto\b/i.test(text);
  const isSuper = /\bsuper\b/i.test(text);
  const isTi = /\bti\b/i.test(text) || /5070TI/i.test(text.replace(/\s/g, ""));
  const condition = conditionFromTitle(title, input.url);

  let confidence = 0.25;
  if (chip) confidence += 0.15;
  if (vramGb != null) confidence += 0.1;
  if (modelLine) confidence += 0.05;
  if (vendor !== "unknown") confidence += 0.05;
  confidence = Math.min(0.65, confidence);

  const key: GpuCanonicalKey = {
    vendor,
    chip: chip ?? "unknown-chip",
    vramGb,
    modelLine,
    oc,
  };

  return {
    key,
    keyString: buildGpuKeyString(key),
    parsed: {
      ...key,
      condition,
      isSuper,
      isTi,
    },
    confidence,
  };
}