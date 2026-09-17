import type { BaseSubmissionMetadata, FormSchema, FormValues } from "./types";

export interface SubmissionGuardContext<TMeta extends BaseSubmissionMetadata | undefined = undefined> {
  readonly formId: string;
  readonly formVersion: number;
  readonly locale: string;
  readonly submittedAt: string;
  readonly challengeToken?: string;
  readonly clientKey?: string;
  readonly honeypotValue?: string;
  readonly metadata?: TMeta;
}

export type SubmissionGuardResult =
  | { readonly status: "allow" }
  | { readonly status: "confirm"; readonly message?: string }
  | { readonly status: "block"; readonly message?: string };

export type SubmissionGuard<TMeta extends BaseSubmissionMetadata | undefined = undefined> = (input: {
  readonly schema: FormSchema;
  readonly values: FormValues;
  readonly context: SubmissionGuardContext<TMeta>;
}) => SubmissionGuardResult | Promise<SubmissionGuardResult>;

export function createHoneypotGuard<TMeta extends BaseSubmissionMetadata | undefined = undefined>(
  fieldId?: string
): SubmissionGuard<TMeta> {
  return ({ context, values }) => {
    const value = context.honeypotValue ?? (fieldId === undefined ? undefined : values[fieldId]);
    const filled = typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== false;
    return filled ? { status: "block", message: "Honeypot field was filled." } : { status: "allow" };
  };
}

export interface RateLimiter {
  check(key: string, now?: Date): Promise<{ readonly allowed: boolean; readonly retryAfterMs?: number }>;
}

export function createMemoryRateLimiter(options: { readonly limit: number; readonly windowMs: number }): RateLimiter {
  const attempts = new Map<string, { readonly startedAt: number; readonly count: number }>();
  return {
    async check(key, now = new Date()) {
      const timestamp = now.getTime();
      const current = attempts.get(key);
      if (current === undefined || timestamp - current.startedAt >= options.windowMs) {
        attempts.set(key, { startedAt: timestamp, count: 1 });
        return { allowed: true };
      }
      if (current.count >= options.limit) {
        return { allowed: false, retryAfterMs: Math.max(0, options.windowMs - (timestamp - current.startedAt)) };
      }
      attempts.set(key, { startedAt: current.startedAt, count: current.count + 1 });
      return { allowed: true };
    }
  };
}

export function createRateLimitGuard<TMeta extends BaseSubmissionMetadata | undefined = undefined>(
  limiter: RateLimiter,
  keyFrom: (context: SubmissionGuardContext<TMeta>) => string
): SubmissionGuard<TMeta> {
  return async ({ context }) => {
    const result = await limiter.check(keyFrom(context), new Date(context.submittedAt));
    return result.allowed
      ? { status: "allow" }
      : {
          status: "block",
          message: `Rate limit exceeded${result.retryAfterMs === undefined ? "" : `; retry in ${result.retryAfterMs}ms`}.`
        };
  };
}

export function createChallengeGuard<TMeta extends BaseSubmissionMetadata | undefined = undefined>(
  verify: (token: string, context: SubmissionGuardContext<TMeta>) => boolean | Promise<boolean>
): SubmissionGuard<TMeta> {
  return async ({ context }) => {
    if (context.challengeToken === undefined || !(await verify(context.challengeToken, context))) {
      return { status: "block", message: "Challenge verification failed." };
    }
    return { status: "allow" };
  };
}
