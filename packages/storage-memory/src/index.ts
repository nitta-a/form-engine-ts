import type { FormSubmission, FormValue, FormValues, StorageAdapter } from "@form-engine/core";

function cloneValue(value: FormValue): FormValue {
  return Array.isArray(value) ? [...value] : value;
}

function cloneValues(values: FormValues): FormValues {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, cloneValue(value)]));
}

function cloneSubmission(submission: FormSubmission): FormSubmission {
  return {
    id: submission.id,
    formId: submission.formId,
    formVersion: submission.formVersion,
    locale: submission.locale,
    values: cloneValues(submission.values),
    submittedAt: submission.submittedAt
  };
}

export class DuplicateSubmissionError extends Error {
  constructor(id: string) {
    super(`A submission with ID "${id}" already exists.`);
    this.name = "DuplicateSubmissionError";
  }
}

export class MemoryStorageAdapter implements StorageAdapter {
  readonly #submissions = new Map<string, FormSubmission>();

  async saveSubmission(submission: FormSubmission): Promise<void> {
    if (this.#submissions.has(submission.id)) throw new DuplicateSubmissionError(submission.id);
    this.#submissions.set(submission.id, cloneSubmission(submission));
  }

  async listSubmissions(formId: string, formVersion?: number): Promise<readonly FormSubmission[]> {
    return [...this.#submissions.values()]
      .filter(
        (submission) =>
          submission.formId === formId && (formVersion === undefined || submission.formVersion === formVersion)
      )
      .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt))
      .map(cloneSubmission);
  }

  async clear(): Promise<void> {
    this.#submissions.clear();
  }
}
