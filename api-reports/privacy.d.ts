import { FormSchema, FormSubmissionError } from '@form-engine-ts/core';

interface SensitiveDataFinding {
    readonly fieldId: string;
    readonly fieldTitle?: string;
    readonly type: "email" | "phone" | "url" | "postal_code" | string;
    readonly typeLabel?: string;
    readonly start?: number;
    readonly end?: number;
    readonly matchedText?: string;
    readonly maskedText?: string;
}
interface SensitiveDataDetectorRule {
    readonly type: string;
    readonly pattern: RegExp;
    readonly enabled?: boolean;
}
interface PrivacyDetectorConfig {
    readonly rules?: readonly SensitiveDataDetectorRule[];
    readonly customDetectors?: readonly ((fieldId: string, text: string) => readonly SensitiveDataFinding[])[];
}
interface SensitiveDataDetector {
    detect(schema: FormSchema, values: Record<string, unknown>): readonly SensitiveDataFinding[];
}
declare function normalizePiiFindingsToMetadata(findings: readonly SensitiveDataFinding[], userConfirmed: boolean): {
    readonly piiConfirmed: boolean;
    readonly piiFindingTypes: readonly string[];
    readonly piiDetectedCount: number;
};
declare const createSubmissionErrorFromPii: (findings: readonly SensitiveDataFinding[], options?: {
    readonly messageKey?: string;
    readonly formTitleMap?: Record<string, string>;
}) => FormSubmissionError;
declare function createStandardPrivacyDetector(config?: PrivacyDetectorConfig): SensitiveDataDetector;

export { type PrivacyDetectorConfig, type SensitiveDataDetector, type SensitiveDataDetectorRule, type SensitiveDataFinding, createStandardPrivacyDetector, createSubmissionErrorFromPii, normalizePiiFindingsToMetadata };
