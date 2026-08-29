export type AggregationSkipReason =
  | "missing_field"
  | "type_mismatch"
  | "invalid_option"
  | "unsupported_version"
  | "locale_mismatch"
  | "pii_unconfirmed";

export interface AggregationReport {
  readonly totalProcessed: number;
  readonly aggregatedCount: number;
  readonly skippedItems: readonly {
    readonly submissionId: string;
    readonly fieldId: string;
    readonly reason: AggregationSkipReason;
  }[];
}
