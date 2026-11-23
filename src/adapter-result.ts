export type AdapterOutcome =
  | "ok"
  | "blocked"
  | "rate_limited"
  | "not_found"
  | "parse_error";

export type AdapterResult<T> =
  | { outcome: "ok"; data: T }
  | { outcome: "blocked"; message: string; httpStatus?: number }
  | { outcome: "rate_limited"; message: string; httpStatus?: number }
  | { outcome: "not_found"; message: string; url?: string }
  | { outcome: "parse_error"; message: string; url?: string };

export interface SourceHealthSummary {
  sourceId: string;
  fetchesAttempted: number;
  fetchesOk: number;
  stoppedForRun: boolean;
  stopReason?: "blocked" | "rate_limited" | "max_per_run";
  lastOutcome?: AdapterOutcome;
  lastMessage?: string;
}

export function createSourceHealth(sourceId: string): SourceHealthSummary & {
  recordAttempt(): void;
  recordOk(): void;
  stop(reason: SourceHealthSummary["stopReason"], message: string, outcome: AdapterOutcome): void;
} {
  const state: SourceHealthSummary = {
    sourceId,
    fetchesAttempted: 0,
    fetchesOk: 0,
    stoppedForRun: false,
  };
  return Object.assign(state, {
    recordAttempt() {
      state.fetchesAttempted += 1;
    },
    recordOk() {
      state.fetchesOk += 1;
      state.lastOutcome = "ok";
    },
    stop(
      reason: SourceHealthSummary["stopReason"],
      message: string,
      outcome: AdapterOutcome
    ) {
      state.stoppedForRun = true;
      state.stopReason = reason;
      state.lastMessage = message;
      state.lastOutcome = outcome;
    },
  });
}