import {
  assertValidFormSchema,
  calculateFieldVisibility,
  type FormField,
  type FormSchema,
  type FormValue,
  type FormValues,
  selectVisibleAnswers,
  type TranslationAdapter,
  type ValidationIssue,
  validateAnswers
} from "@form-engine-ts/core";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type SubmitStatus = "idle" | "submitting" | "success" | "error";

export interface FormContextValue {
  readonly schema: FormSchema;
  readonly locale: string;
  readonly translator: TranslationAdapter;
  readonly values: FormValues;
  readonly visibility: Readonly<Record<string, boolean>>;
  readonly errors: Readonly<Record<string, ValidationIssue | undefined>>;
  readonly submitStatus: SubmitStatus;
  readonly submitError: Error | null;
  readonly isSubmitting: boolean;
  readonly setValue: (fieldId: string, value: FormValue) => void;
  readonly reset: () => void;
  readonly submit: () => Promise<boolean>;
  readonly translate: (key: string, params?: Readonly<Record<string, string | number>>) => string;
}

const FormContext = createContext<FormContextValue | null>(null);

function issuesByField(issues: readonly ValidationIssue[]): Record<string, ValidationIssue | undefined> {
  const result: Record<string, ValidationIssue | undefined> = {};
  for (const issue of issues) result[issue.fieldId] ??= issue;
  return result;
}

export interface FormProviderProps {
  readonly schema: FormSchema;
  readonly locale: string;
  readonly translator: TranslationAdapter;
  readonly initialValues?: FormValues;
  readonly resetOnSuccess?: boolean;
  readonly onSubmit: (values: FormValues) => void | Promise<void>;
  readonly children: ReactNode;
}

export function FormProvider({
  schema,
  locale,
  translator,
  initialValues = {},
  resetOnSuccess = false,
  onSubmit,
  children
}: FormProviderProps) {
  const validSchema = useMemo(() => {
    assertValidFormSchema(schema);
    return schema;
  }, [schema]);
  const [values, setValues] = useState<FormValues>(() => ({ ...initialValues }));
  const [errors, setErrors] = useState<Record<string, ValidationIssue | undefined>>({});
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<Error | null>(null);
  const visibility = useMemo(() => calculateFieldVisibility(validSchema, values), [validSchema, values]);

  useEffect(() => {
    const fieldIds = new Set(validSchema.fields.map((field) => field.id));
    setValues((current) => Object.fromEntries(Object.entries(current).filter(([fieldId]) => fieldIds.has(fieldId))));
  }, [validSchema]);

  const setValue = useCallback(
    (fieldId: string, value: FormValue) => {
      setValues((current) => {
        const next = { ...current, [fieldId]: value };
        setErrors((currentErrors) => {
          if (Object.keys(currentErrors).length === 0) return currentErrors;
          const result = validateAnswers(validSchema, next);
          return issuesByField(result.issues);
        });
        return next;
      });
      setSubmitStatus((current) => (current === "success" || current === "error" ? "idle" : current));
      setSubmitError(null);
    },
    [validSchema]
  );

  const reset = useCallback(() => {
    setValues({ ...initialValues });
    setErrors({});
    setSubmitStatus("idle");
    setSubmitError(null);
  }, [initialValues]);

  const submit = useCallback(async (): Promise<boolean> => {
    const validation = validateAnswers(validSchema, values);
    if (!validation.valid) {
      setErrors(issuesByField(validation.issues));
      setSubmitStatus("error");
      setSubmitError(null);
      return false;
    }
    setErrors({});
    setSubmitStatus("submitting");
    setSubmitError(null);
    try {
      await onSubmit(selectVisibleAnswers(validSchema, values));
      if (resetOnSuccess) setValues({ ...initialValues });
      setSubmitStatus("success");
      return true;
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause : new Error(String(cause)));
      setSubmitStatus("error");
      return false;
    }
  }, [initialValues, onSubmit, resetOnSuccess, validSchema, values]);

  const translate = useCallback(
    (key: string, params?: Readonly<Record<string, string | number>>) => translator.translate(key, locale, params),
    [locale, translator]
  );

  const contextValue = useMemo<FormContextValue>(
    () => ({
      schema: validSchema,
      locale,
      translator,
      values,
      visibility,
      errors,
      submitStatus,
      submitError,
      isSubmitting: submitStatus === "submitting",
      setValue,
      reset,
      submit,
      translate
    }),
    [
      errors,
      locale,
      reset,
      setValue,
      submit,
      submitError,
      submitStatus,
      translate,
      translator,
      validSchema,
      values,
      visibility
    ]
  );

  return <FormContext.Provider value={contextValue}>{children}</FormContext.Provider>;
}

export function useForm(): FormContextValue {
  const context = useContext(FormContext);
  if (context === null) throw new Error("useForm must be called inside a FormProvider.");
  return context;
}

export interface FieldState {
  readonly field: FormField;
  readonly value: FormValue;
  readonly error: ValidationIssue | undefined;
  readonly setValue: (value: FormValue) => void;
}

export function useField(fieldId: string): FieldState {
  const form = useForm();
  const field = form.schema.fields.find((item) => item.id === fieldId);
  if (field === undefined) throw new Error(`Unknown form field: ${fieldId}`);
  const setValue = useCallback((value: FormValue) => form.setValue(fieldId, value), [fieldId, form]);
  return { field, value: form.values[fieldId], error: form.errors[fieldId], setValue };
}
