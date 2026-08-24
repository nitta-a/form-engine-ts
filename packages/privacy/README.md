# @form-engine-ts/privacy

Framework-independent sensitive-data candidate detection for form-engine-ts. The standard detector scans only text and
textarea answers for email addresses, phone numbers, HTTP(S) URLs, and postal codes. Rules and custom detectors are
injectable, and findings are advisory so applications can choose confirm, block, or audit behavior.

```ts
import { createStandardPrivacyDetector } from "@form-engine-ts/privacy";

const detector = createStandardPrivacyDetector();
const findings = detector.detect(schema, values);
```
