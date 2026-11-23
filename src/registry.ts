import sourcesFile from "../sources.json" with { type: "json" };
import type { SourceRecord, SourcesFile } from "./types.js";
import { createCanadaComputersAdapter } from "./adapters/canada-computers.js";
import type { AdapterContext, SourceAdapter } from "./types.js";

const SOURCES = (sourcesFile as SourcesFile).sources;

export function listSources(): SourceRecord[] {
  return [...SOURCES];
}

export function getSourceRecord(id: string): SourceRecord | undefined {
  return SOURCES.find((s) => s.id === id);
}

export function assertSourceCleared(id: string): SourceRecord {
  const record = getSourceRecord(id);
  if (!record) {
    throw new Error(`Unknown source id: ${id}`);
  }
  if (record.clearance !== "cleared") {
    throw new Error(
      `Source "${id}" is not cleared (status: ${record.clearance}). Only cleared sources may be fetched.`
    );
  }
  return record;
}

const ADAPTER_FACTORIES: Record<
  string,
  (ctx: AdapterContext) => SourceAdapter
> = {
  canadacomputers: createCanadaComputersAdapter,
};

export function createAdapter(
  id: string,
  ctx: AdapterContext
): SourceAdapter {
  assertSourceCleared(id);
  const factory = ADAPTER_FACTORIES[id];
  if (!factory) {
    throw new Error(`No adapter implementation for cleared source: ${id}`);
  }
  return factory(ctx);
}