# @form-engine-ts/privacy

Framework-independent sensitive-data candidate detection for form-engine-ts. The standard detector scans only text and
textarea answers for email addresses, phone numbers, HTTP(S)/`www.` URLs, and postal codes. Rules and custom detectors are
injectable, and findings are advisory so applications can choose confirm, block, or audit behavior.

Overlapping or contained findings with the same field and type are merged into one source range.

`SensitiveDataFinding` also supports optional `fieldTitle`, `typeLabel`, and `maskedText` values so a renderer can show a
localized, privacy-safe confirmation summary without exposing the original match.

```ts
import { createStandardPrivacyDetector } from "@form-engine-ts/privacy";

const detector = createStandardPrivacyDetector();
const findings = detector.detect(schema, values);
```

Use `normalizePiiFindingsToMetadata(findings, userConfirmed)` to persist a compact confirmation flag, distinct finding
types, and the detected count alongside a submission.

Use `createSubmissionErrorFromPii(findings)` to turn findings into a typed `FormSubmissionError` requiring confirmation;
the optional `messageKey` customizes the renderer message key.
