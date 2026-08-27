import {
  type FieldType,
  type FormField,
  type FormSchema,
  type FormValue,
  type FormValues,
  selectVisibleAnswers,
  type TranslationAdapter,
  type ValidationIssue,
  validateAnswers
} from "@form-engine-ts/core";
import type { SensitiveDataFinding } from "@form-engine-ts/privacy";
import {
  type ComponentType,
  type FormEvent,
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
import type { SubmissionAttempt } from "./attempt";
import { FormProvider, useForm } from "./context";
import type { SubmissionReceipt } from "./receipt";
import type {
  BeforeSubmit,
  FormRendererMessages,
  FormRendererSlots,
  FormSubmitHandler,
  FormSubmitStatus,
  FormSubmittedAnswerItem,
  FormSuccessRenderMode,
  RenderSubmitButtonProps,
  SubmissionConfirmationOptions,
  SubmissionConfirmationRenderMode,
  SubmissionGuard,
  SubmissionProtectionProps,
  SubmitResponse,
  SubmitResult
} from "./types";
import { FormSubmissionError } from "./types";

export interface FieldComponentProps {
  readonly field: FormField;
  readonly value: FormValue;
  readonly error: ValidationIssue | undefined;
  readonly setValue: (value: FormValue) => void;
  readonly translate: (key: string, params?: Readonly<Record<string, string | number>>) => string;
  readonly inputId: string;
  readonly errorId: string;
  readonly helpId: string;
  readonly renderCharacterCount?: FormRendererSlots["renderCharacterCount"];
}

export type FieldComponents = Partial<Record<FieldType, ComponentType<FieldComponentProps>>>;

function describedBy(
  field: FormField,
  error: ValidationIssue | undefined,
  helpId: string,
  errorId: string
): string | undefined {
  const ids = [field.description === undefined ? undefined : helpId, error === undefined ? undefined : errorId].filter(
    Boolean
  );
  return ids.length === 0 ? undefined : ids.join(" ");
}

function RequiredMark({ required }: { readonly required: boolean | undefined }) {
  return required ? (
    <span className="fe-required" aria-hidden="true">
      {" "}
      *
    </span>
  ) : null;
}

function FieldMessage({ props }: { readonly props: FieldComponentProps }) {
  return (
    <>
      {props.field.description === undefined ? null : (
        <div id={props.helpId} className="fe-help">
          {props.field.description}
        </div>
      )}
      {props.error === undefined ? null : (
        <div id={props.errorId} className="fe-error">
          {props.translate(props.error.messageKey, props.error.params)}
        </div>
      )}
    </>
  );
}

function DefaultField(props: FieldComponentProps) {
  const { field, value, setValue, inputId, error, translate } = props;
  const ariaProps = {
    "aria-describedby": describedBy(field, error, props.helpId, props.errorId),
    "aria-invalid": error === undefined ? undefined : true
  } as const;

  if (field.type === "checkbox") {
    return (
      <div className="fe-field fe-field--checkbox" data-field-id={field.id}>
        <label className="fe-check-label" htmlFor={inputId}>
          <input
            {...ariaProps}
            id={inputId}
            name={field.id}
            type="checkbox"
            checked={value === true}
            onChange={(event) => setValue(event.currentTarget.checked)}
          />
          <span>
            {field.title}
            <RequiredMark required={field.required} />
          </span>
        </label>
        <FieldMessage props={props} />
      </div>
    );
  }

  if (field.type === "radio" || field.type === "multi-select") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset className={`fe-field fe-field--${field.type}`} data-field-id={field.id} {...ariaProps}>
        <legend className="fe-label">
          {field.title}
          <RequiredMark required={field.required} />
        </legend>
        {field.options.map((option, index) => {
          const optionId = `${inputId}-${index}`;
          const checked = field.type === "radio" ? value === option.id : selected.includes(option.id);
          return (
            <label className="fe-check-label" htmlFor={optionId} key={option.id}>
              <input
                id={optionId}
                name={field.id}
                type={field.type === "radio" ? "radio" : "checkbox"}
                value={option.id}
                checked={checked}
                onChange={(event) => {
                  if (field.type === "radio") setValue(option.id);
                  else
                    setValue(
                      event.currentTarget.checked
                        ? [...selected, option.id]
                        : selected.filter((item) => item !== option.id)
                    );
                }}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
        <FieldMessage props={props} />
      </fieldset>
    );
  }

  if (field.type === "rating") {
    const min = field.min ?? 1;
    const max = field.max ?? 5;
    return (
      <fieldset className="fe-field fe-field--rating" data-field-id={field.id} {...ariaProps}>
        <legend className="fe-label">
          {field.title}
          <RequiredMark required={field.required} />
        </legend>
        <div className="fe-rating-options">
          {Array.from({ length: max - min + 1 }, (_, index) => min + index).map((rating) => {
            const optionId = `${inputId}-${rating}`;
            return (
              <label className="fe-rating-label" htmlFor={optionId} key={rating}>
                <input
                  id={optionId}
                  name={field.id}
                  type="radio"
                  value={rating}
                  checked={value === rating}
                  onChange={() => setValue(rating)}
                />
                <span>{rating}</span>
              </label>
            );
          })}
        </div>
        <FieldMessage props={props} />
      </fieldset>
    );
  }

  const label = (
    <label className="fe-label" htmlFor={inputId}>
      {field.title}
      <RequiredMark required={field.required} />
    </label>
  );
  let control: ReactNode;
  const textConstraints =
    field.type === "text" || field.type === "textarea"
      ? {
          minLength: field.minLength,
          maxLength: field.maxLength,
          ...(field.pattern === undefined ? {} : { pattern: field.pattern })
        }
      : {};
  if (field.type === "textarea") {
    control = (
      <textarea
        {...ariaProps}
        {...textConstraints}
        id={inputId}
        name={field.id}
        placeholder={field.placeholderKey === undefined ? undefined : translate(field.placeholderKey)}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => setValue(event.currentTarget.value)}
      />
    );
  } else if (field.type === "number") {
    control = (
      <input
        {...ariaProps}
        {...textConstraints}
        id={inputId}
        name={field.id}
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        placeholder={field.placeholderKey === undefined ? undefined : translate(field.placeholderKey)}
        value={typeof value === "number" ? value : ""}
        onChange={(event) => setValue(event.currentTarget.value === "" ? undefined : event.currentTarget.valueAsNumber)}
      />
    );
  } else if (field.type === "select") {
    control = (
      <select
        {...ariaProps}
        id={inputId}
        name={field.id}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => setValue(event.currentTarget.value || undefined)}
      >
        <option value="">—</option>
        {field.options.map((option) => (
          <option value={option.id} key={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    );
  } else {
    const placeholderKey = "placeholderKey" in field ? field.placeholderKey : undefined;
    control = (
      <input
        {...ariaProps}
        id={inputId}
        name={field.id}
        type="text"
        placeholder={placeholderKey === undefined ? undefined : translate(placeholderKey)}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => setValue(event.currentTarget.value)}
      />
    );
  }
  return (
    <div className={`fe-field fe-field--${field.type}`} data-field-id={field.id}>
      {label}
      {control}
      {(field.type === "text" || field.type === "textarea") && field.maxLength !== undefined
        ? (props.renderCharacterCount?.({
            fieldId: field.id,
            current: typeof value === "string" ? value.length : 0,
            max: field.maxLength
          }) ?? (
            <div className="fe-character-count" aria-live="polite">
              {typeof value === "string" ? value.length : 0} / {field.maxLength}
            </div>
          ))
        : null}
      <FieldMessage props={props} />
    </div>
  );
}

export interface FormRendererPresentationProps extends SubmissionProtectionProps {
  readonly components?: FieldComponents;
  readonly className?: string;
  /**
   * Controls where the completion message is rendered after a successful submission.
   * Defaults to "append" for backwards compatibility.
   */
  readonly successRenderMode?: FormSuccessRenderMode;
  readonly submissionConfirmation?: SubmissionConfirmationOptions;
  /** @deprecated Use submissionConfirmation.renderMode instead. */
  readonly submissionConfirmationRenderMode?: SubmissionConfirmationRenderMode;
  readonly showHiddenFieldsInSummary?: boolean;
  readonly fieldsClassName?: string;
  /** @deprecated Use successRenderMode="replace" instead. */
  readonly hideFormOnSuccess?: boolean;
  readonly successMessageKey?: string;
  readonly errorMessageKey?: string;
  readonly attemptIdFactory?: () => string;
  readonly messages?: Partial<FormRendererMessages>;
  readonly messageResolver?: (key: keyof FormRendererMessages, defaultText: string) => string;
  readonly autoSaveKey?: string;
  readonly beforeSubmit?: BeforeSubmit;
  readonly onDraftSave?: (draft: FormValues) => void;
  readonly slots?: FormRendererSlots;
}

export interface StandaloneFormRendererProps extends FormRendererPresentationProps {
  readonly schema: FormSchema;
  readonly locale?: string;
  readonly translator?: TranslationAdapter;
  readonly initialValues?: FormValues;
  readonly resetOnSuccess?: boolean;
  readonly onSubmit: FormSubmitHandler;
}

export type FormRendererProps = FormRendererPresentationProps | StandaloneFormRendererProps;

interface StoredDraft {
  readonly formId: string;
  readonly formVersion: number;
  readonly values: Readonly<Record<string, FormValue>>;
  readonly savedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFormValue(value: unknown): value is FormValue {
  return (
    value === undefined ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}

function displaySubmittedValue(field: FormField, value: unknown, translate: (key: string) => string): string {
  if (value === undefined || value === null) return "";
  if (field.type === "checkbox") return value === true ? translate("form.yes") : translate("form.no");
  if (field.type === "multi-select" && Array.isArray(value)) {
    const labels = new Map(field.options.map((option) => [option.id, option.label]));
    return value.map((item) => labels.get(item) ?? item).join(", ");
  }
  if ((field.type === "radio" || field.type === "select") && typeof value === "string") {
    return field.options.find((option) => option.id === value)?.label ?? value;
  }
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function buildSubmittedItems(
  schema: FormSchema,
  answers: FormValues,
  visibility: Readonly<Record<string, boolean>>,
  translate: (key: string) => string,
  showHiddenFields: boolean
): readonly FormSubmittedAnswerItem[] {
  return schema.fields
    .filter((field) => showHiddenFields || visibility[field.id] === true)
    .map((field) => ({
      fieldId: field.id,
      title: field.title,
      type: field.type,
      rawValue: answers[field.id],
      displayValue: displaySubmittedValue(field, answers[field.id], translate),
      visible: visibility[field.id] === true,
      ...(field.metadata === undefined ? {} : { metadata: field.metadata })
    }));
}

function parseDraft(serialized: string): StoredDraft | null {
  try {
    const value: unknown = JSON.parse(serialized);
    if (
      !isRecord(value) ||
      typeof value.formId !== "string" ||
      typeof value.formVersion !== "number" ||
      !Number.isInteger(value.formVersion) ||
      typeof value.savedAt !== "string" ||
      !isRecord(value.values) ||
      !Object.values(value.values).every(isFormValue)
    ) {
      return null;
    }
    return {
      formId: value.formId,
      formVersion: value.formVersion,
      savedAt: value.savedAt,
      values: Object.fromEntries(
        Object.entries(value.values).filter((entry): entry is [string, FormValue] => isFormValue(entry[1]))
      )
    };
  } catch {
    return null;
  }
}

const DEFAULT_RENDERER_MESSAGES: Readonly<Record<"en" | "ja", FormRendererMessages>> = {
  en: {
    submitButton: "Submit",
    submittingButton: "Submitting...",
    retryButton: "Retry",
    requiredField: "This field is required.",
    alreadySubmittedTitle: "Already Submitted",
    alreadySubmittedMessage: "Already submitted.",
    serverErrorSummary: "Submission failed. Please check your answers and try again.",
    confirmSensitiveDataTitle: "Sensitive data may be included",
    confirmSensitiveDataMessage: "The following answers may contain personal information. Continue submitting?",
    confirmButton: "Proceed",
    cancelButton: "Cancel"
  },
  ja: {
    submitButton: "送信する",
    submittingButton: "送信中...",
    retryButton: "再送信する",
    requiredField: "この項目は必須です",
    alreadySubmittedTitle: "回答済みです",
    alreadySubmittedMessage: "このアンケートにはすでに回答しています。",
    serverErrorSummary: "送信に失敗しました。内容をご確認の上、再度お試しください。",
    confirmSensitiveDataTitle: "個人情報が含まれている可能性があります",
    confirmSensitiveDataMessage: "以下の項目に個人情報とみられる記述があります。このまま送信してもよろしいですか？",
    confirmButton: "このまま送信",
    cancelButton: "修正する"
  }
};

function createRendererAttemptId(): string {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (typeof randomUuid === "function") return randomUuid.call(globalThis.crypto);
  return `attempt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function maskSensitiveValue(finding: SensitiveDataFinding): string | undefined {
  if (finding.maskedText !== undefined) return finding.maskedText;
  const value = finding.matchedText;
  if (value === undefined) return undefined;
  if (finding.type === "email") {
    const separator = value.indexOf("@");
    if (separator > 0) return `${value.slice(0, Math.min(2, separator))}***${value.slice(separator)}`;
  }
  if (finding.type === "phone" || finding.type === "postal_code") return "***";
  return value.length <= 2 ? "***" : `${value.slice(0, 2)}***`;
}

function ContextFormRenderer({
  components = {},
  className = "",
  successMessageKey,
  errorMessageKey,
  attemptIdFactory,
  messages = {},
  messageResolver,
  autoSaveKey,
  beforeSubmit,
  onDraftSave,
  successRenderMode = "append",
  submissionConfirmation,
  submissionConfirmationRenderMode,
  showHiddenFieldsInSummary = false,
  fieldsClassName,
  hideFormOnSuccess = false,
  submissionGuards = [],
  receiptStore,
  attemptStore,
  onReceiptError,
  slots = {}
}: FormRendererPresentationProps) {
  const form = useForm();
  const prefix = useId().replace(/:/g, "");
  const formRef = useRef<HTMLFormElement>(null);
  const loadedDraftKey = useRef<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [focusFieldId, setFocusFieldId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    readonly findings: readonly SensitiveDataFinding[];
    readonly message?: string;
    readonly generic: boolean;
  } | null>(null);
  const [guardMessage, setGuardMessage] = useState<string | null>(null);
  const [guardsPending, setGuardsPending] = useState(false);
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const [completionData, setCompletionData] = useState<{
    readonly answers: Readonly<Record<string, unknown>>;
    readonly submittedItems: readonly FormSubmittedAnswerItem[];
    readonly response?: SubmitResponse;
  } | null>(null);
  const [receiptLoaded, setReceiptLoaded] = useState(receiptStore === undefined);
  const rendererSubmissionInFlight = useRef(false);
  const fallbackAttemptId = useRef<string | null>(null);
  const completionRef = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const pages = form.schema.pages;
  const visiblePageIndexes = useMemo(
    () =>
      pages === undefined ? [] : pages.flatMap((page, index) => (form.pageVisibility[page.id] === true ? [index] : [])),
    [form.pageVisibility, pages]
  );
  const activePage = pages?.[currentPageIndex];
  const activeVisibleIndex = visiblePageIndexes.indexOf(currentPageIndex);
  const fieldIds = activePage === undefined ? undefined : new Set(activePage.questionIds);
  const visibleValues = useMemo(() => selectVisibleAnswers(form.schema, form.values), [form.schema, form.values]);
  const visibleItems = useMemo(
    () => buildSubmittedItems(form.schema, form.values, form.visibility, (key) => form.translate(key), false),
    [form.schema, form.translate, form.values, form.visibility]
  );
  const confirmationRenderMode: SubmissionConfirmationRenderMode =
    submissionConfirmation?.renderMode ?? submissionConfirmationRenderMode ?? "inline";
  const confirmationEnabled = submissionConfirmation?.enabled === true;
  const submitState: FormSubmitStatus = confirmation === null && !guardsPending ? form.submitStatus : "confirming";
  const interactionLocked = submitState === "confirming" || submitState === "submitting";
  const isReplaceMode = successRenderMode === "replace" || hideFormOnSuccess;

  const resolveMessage = useCallback(
    (key: keyof FormRendererMessages, fallback?: string): string => {
      const defaultText =
        fallback ?? DEFAULT_RENDERER_MESSAGES[form.locale.toLowerCase().startsWith("ja") ? "ja" : "en"][key] ?? key;
      const configured = messages[key];
      return messageResolver?.(key, configured ?? defaultText) ?? configured ?? defaultText;
    },
    [form.locale, messageResolver, messages]
  );

  const fieldTranslate = useCallback(
    (key: string, params?: Readonly<Record<string, string | number>>) =>
      key === "validation.required" && (messages.requiredField !== undefined || messageResolver !== undefined)
        ? resolveMessage("requiredField")
        : form.translate(key, params),
    [form.translate, messageResolver, messages.requiredField, resolveMessage]
  );

  const focusSubmitButton = useCallback(() => {
    const button = formRef.current?.querySelector<HTMLElement>(".fe-submit, button[type='submit'], button");
    button?.focus();
  }, []);

  useEffect(() => {
    let active = true;
    if (receiptStore === undefined) {
      setReceipt(null);
      setReceiptLoaded(true);
      return () => {
        active = false;
      };
    }
    setReceiptLoaded(false);
    void receiptStore
      .get(form.schema.id, form.schema.version)
      .then((stored) => {
        if (active) setReceipt(stored);
      })
      .catch(() => {
        if (active) setReceipt(null);
      })
      .finally(() => {
        if (active) setReceiptLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [form.schema.id, form.schema.version, receiptStore]);

  useEffect(() => {
    if (pages === undefined || visiblePageIndexes.length === 0) {
      setCurrentPageIndex(0);
      return;
    }
    if (!visiblePageIndexes.includes(currentPageIndex)) setCurrentPageIndex(visiblePageIndexes[0] ?? 0);
  }, [currentPageIndex, pages, visiblePageIndexes]);

  useEffect(() => {
    if (focusFieldId === null) return;
    const fieldContainer = [...(formRef.current?.querySelectorAll<HTMLElement>("[data-field-id]") ?? [])].find(
      (element) => element.dataset.fieldId === focusFieldId
    );
    const control = fieldContainer?.querySelector<HTMLElement>("input, select, textarea");
    if (control !== undefined && control !== null) {
      control.scrollIntoView?.({ behavior: "smooth", block: "center" });
      control.focus();
      setFocusFieldId(null);
    }
  }, [focusFieldId]);

  useEffect(() => {
    if (!isReplaceMode || form.submitStatus !== "success") return;
    completionRef.current?.focus();
  }, [form.submitStatus, isReplaceMode]);

  useEffect(() => {
    if (confirmation === null) return;
    const confirmButton = confirmationRef.current?.querySelector<HTMLElement>("[data-fe-confirm], button");
    confirmButton?.focus();
    if (confirmationRenderMode !== "dialog") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setConfirmation(null);
        globalThis.setTimeout(focusSubmitButton, 0);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [
        ...(confirmationRef.current?.querySelectorAll<HTMLElement>(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
        ) ?? [])
      ].filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, [confirmation, confirmationRenderMode, focusSubmitButton]);

  useEffect(() => {
    if (autoSaveKey === undefined || typeof globalThis.localStorage === "undefined") return;
    const loadIdentity = `${autoSaveKey}:${form.schema.id}:${form.schema.version}`;
    if (loadedDraftKey.current === loadIdentity) return;
    loadedDraftKey.current = loadIdentity;
    const serialized = globalThis.localStorage.getItem(autoSaveKey);
    if (serialized === null) return;
    const draft = parseDraft(serialized);
    if (draft === null || draft.formId !== form.schema.id || draft.formVersion !== form.schema.version) return;
    form.restoreValues(draft.values);
    setDraftRestored(true);
  }, [autoSaveKey, form.restoreValues, form.schema.id, form.schema.version]);

  useEffect(() => {
    if (form.submitStatus === "success") return;
    const timeout = globalThis.setTimeout(() => {
      onDraftSave?.(form.values);
      if (autoSaveKey === undefined || typeof globalThis.localStorage === "undefined") return;
      const draft: StoredDraft = {
        formId: form.schema.id,
        formVersion: form.schema.version,
        values: form.values,
        savedAt: new Date().toISOString()
      };
      globalThis.localStorage.setItem(autoSaveKey, JSON.stringify(draft));
    }, 500);
    return () => globalThis.clearTimeout(timeout);
  }, [autoSaveKey, form.schema.id, form.schema.version, form.submitStatus, form.values, onDraftSave]);

  const focusFirstIssue = (fieldId: string | undefined) => {
    if (fieldId !== undefined) setFocusFieldId(fieldId);
  };

  const handleNext = () => {
    if (interactionLocked) return;
    const result = form.validatePage(currentPageIndex);
    if (!result.valid) {
      focusFirstIssue(result.issues[0]?.fieldId);
      return;
    }
    const nextPageIndex = visiblePageIndexes[activeVisibleIndex + 1];
    if (nextPageIndex !== undefined) setCurrentPageIndex(nextPageIndex);
  };

  const runSubmissionGuards = async (
    guards: readonly SubmissionGuard[]
  ): Promise<
    | { readonly status: "allow" }
    | {
        readonly status: "confirm" | "block";
        readonly findings: readonly SensitiveDataFinding[];
        readonly message?: string;
      }
  > => {
    const findings: SensitiveDataFinding[] = [];
    let confirmationMessage: string | undefined;
    let requiresConfirmation = false;
    for (const guard of guards) {
      const result = await guard(form.schema, visibleValues);
      if (result.status === "allow") continue;
      findings.push(...result.findings);
      if (result.status === "block") {
        return {
          status: "block",
          findings,
          ...(result.message === undefined ? {} : { message: result.message })
        };
      }
      requiresConfirmation = true;
      confirmationMessage ??= result.message;
    }
    return !requiresConfirmation
      ? { status: "allow" }
      : {
          status: "confirm",
          findings,
          ...(confirmationMessage === undefined ? {} : { message: confirmationMessage })
        };
  };

  const submitValues = async (guardsConfirmed = false): Promise<SubmitResult> => {
    if (
      rendererSubmissionInFlight.current ||
      submitState === "submitting" ||
      submitState === "success" ||
      (confirmation !== null && !guardsConfirmed)
    ) {
      return { status: "cancelled" };
    }
    const validation = validateAnswers(form.schema, form.values);
    const firstInvalidFieldId = validation.issues[0]?.fieldId;
    if (validation.valid && !guardsConfirmed) {
      rendererSubmissionInFlight.current = true;
      setGuardsPending(submissionGuards.length > 0);
      try {
        if (submissionGuards.length > 0) {
          const guardResult = await runSubmissionGuards(submissionGuards);
          if (guardResult.status === "block") {
            setGuardMessage(guardResult.message ?? form.translate("form.submissionBlocked"));
            return { status: "cancelled" };
          }
          if (guardResult.status === "confirm") {
            setGuardMessage(null);
            setConfirmation({
              findings: guardResult.findings,
              generic: false,
              ...(guardResult.message === undefined ? {} : { message: guardResult.message })
            });
            return { status: "cancelled" };
          }
        }
        if (confirmationEnabled) {
          setGuardMessage(null);
          setConfirmation({ findings: [], generic: true });
          return { status: "cancelled" };
        }
      } finally {
        rendererSubmissionInFlight.current = false;
        setGuardsPending(false);
      }
    }
    setGuardMessage(null);
    rendererSubmissionInFlight.current = true;
    try {
      let submissionAttempt: SubmissionAttempt | undefined;
      let attemptId = fallbackAttemptId.current;
      if (attemptStore !== undefined) {
        submissionAttempt = await attemptStore.getOrCreate(form.schema.id, form.schema.version, attemptIdFactory);
        attemptId = submissionAttempt.attemptId;
      } else if (attemptId === null) {
        attemptId = attemptIdFactory?.() ?? createRendererAttemptId();
        fallbackAttemptId.current = attemptId;
      }
      if (attemptId === null) throw new Error("Unable to create a submission attempt id.");
      const submittedAt = new Date().toISOString();
      const submitContext = {
        attemptId,
        formId: form.schema.id,
        formVersion: form.schema.version,
        locale: form.locale,
        submittedAt
      };
      const result = await form.submit(beforeSubmit, submitContext);
      if (result.status === "invalid") {
        const invalidPageIndex = pages?.findIndex((page) =>
          firstInvalidFieldId === undefined ? false : page.questionIds.includes(firstInvalidFieldId)
        );
        if (invalidPageIndex !== undefined && invalidPageIndex >= 0) setCurrentPageIndex(invalidPageIndex);
        focusFirstIssue(firstInvalidFieldId);
        return result;
      }
      if (result.status === "error") {
        if (result.error instanceof FormSubmissionError) {
          const fieldErrors = result.error.payload.fieldErrors ?? {};
          form.setServerErrors?.(fieldErrors);
          const firstServerFieldId =
            form.schema.fields.find((field) => Object.hasOwn(fieldErrors, field.id))?.id ?? Object.keys(fieldErrors)[0];
          if (firstServerFieldId !== undefined) {
            const invalidPageIndex = pages?.findIndex((page) => page.questionIds.includes(firstServerFieldId));
            if (invalidPageIndex !== undefined && invalidPageIndex >= 0) setCurrentPageIndex(invalidPageIndex);
            focusFirstIssue(firstServerFieldId);
          }
        }
        return result;
      }
      if (result.status !== "success") return result;
      const submittedAnswers = { ...form.values };
      const submittedItems = buildSubmittedItems(
        form.schema,
        submittedAnswers,
        form.visibility,
        (key) => form.translate(key),
        showHiddenFieldsInSummary
      );
      setCompletionData({
        answers: submittedAnswers,
        submittedItems,
        ...(result.response === undefined ? {} : { response: result.response })
      });
      if (receiptStore !== undefined) {
        const response = result.response;
        const submissionId = response?.submissionId ?? submissionAttempt?.attemptId ?? attemptId;
        const storedReceipt: SubmissionReceipt = {
          formId: form.schema.id,
          formVersion: form.schema.version,
          submittedAt: response?.submittedAt ?? submittedAt,
          ...(submissionId === undefined ? {} : { submissionId })
        };
        try {
          await receiptStore.save(storedReceipt);
        } catch (cause) {
          const error = cause instanceof Error ? cause : new Error(String(cause));
          try {
            onReceiptError?.(error, storedReceipt);
          } catch {
            // Receipt notifications must not change a successful submission result.
          }
        }
      }
      if (attemptStore !== undefined && submissionAttempt !== undefined) {
        try {
          await attemptStore.clear(form.schema.id, form.schema.version);
        } catch {
          // Attempt cleanup must not change a successful server submission result.
        }
      }
      if (attemptStore === undefined) fallbackAttemptId.current = null;
      if (autoSaveKey !== undefined && typeof globalThis.localStorage !== "undefined") {
        globalThis.localStorage.removeItem(autoSaveKey);
        setDraftRestored(false);
      }
      setCurrentPageIndex(visiblePageIndexes[0] ?? 0);
      return result;
    } finally {
      rendererSubmissionInFlight.current = false;
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitState === "submitting" || submitState === "confirming" || submitState === "success") return;
    void submitValues();
  };

  const confirmSubmission = () => {
    setConfirmation(null);
    void submitValues(true);
  };

  const cancelSubmission = () => {
    setConfirmation(null);
    globalThis.setTimeout(focusSubmitButton, 0);
  };

  const resetReceipt = async () => {
    if (receiptStore === undefined) return;
    await receiptStore.remove(form.schema.id, form.schema.version);
    setReceipt(null);
    form.reset();
  };

  const validationIssues = Object.values(form.errors).filter((issue): issue is ValidationIssue => issue !== undefined);
  const canPrev = pages !== undefined && activeVisibleIndex > 0;
  const canNext = pages !== undefined && activeVisibleIndex < visiblePageIndexes.length - 1;
  const renderSubmitButton = () => {
    const submitButtonProps: RenderSubmitButtonProps = {
      isSubmitting: submitState === "submitting",
      submitStatus: submitState,
      disabled: interactionLocked || submitState === "success",
      onSubmit: () => void submitValues()
    };
    return (
      slots.renderSubmitButton?.(submitButtonProps) ?? (
        <button className="fe-submit" type="submit" disabled={submitButtonProps.disabled}>
          {submitState === "submitting" ? <span className="fe-spinner" aria-hidden="true" /> : null}
          {submitState === "submitting"
            ? resolveMessage("submittingButton")
            : resolveMessage("submitButton", form.translate(form.schema.submitLabelKey ?? "form.submit"))}
        </button>
      )
    );
  };

  const completionMessage =
    form.schema.completionMessage ??
    (successMessageKey === undefined ? "Submitted." : form.translate(successMessageKey));
  const activeCompletionData = completionData ?? {
    answers: { ...form.values },
    submittedItems: buildSubmittedItems(
      form.schema,
      form.values,
      form.visibility,
      (key) => form.translate(key),
      showHiddenFieldsInSummary
    )
  };
  const completionProps = {
    message: completionMessage,
    schema: form.schema,
    answers: activeCompletionData.answers,
    submittedItems: activeCompletionData.submittedItems,
    ...(activeCompletionData.response === undefined ? {} : { response: activeCompletionData.response }),
    onReset: form.reset
  };
  const completionRegion = (
    <div ref={completionRef} className="fe-completion" role="status" aria-live="polite" tabIndex={-1}>
      {slots.renderCompletion?.(completionProps) ?? <div>{completionMessage}</div>}
      {slots.renderSubmittedValues?.({ items: activeCompletionData.submittedItems, schema: form.schema })}
    </div>
  );

  const confirmationContent = (
    <div
      ref={confirmationRef}
      className="fe-submission-confirmation"
      role={confirmationRenderMode === "dialog" ? undefined : "dialog"}
    >
      {slots.renderSubmissionConfirmation?.({
        findings: confirmation?.findings ?? [],
        message:
          confirmation?.message ??
          (confirmation?.generic === true
            ? form.locale.toLowerCase().startsWith("ja")
              ? "回答内容をご確認のうえ、送信してください。"
              : "Please review your answers before submitting."
            : resolveMessage("confirmSensitiveDataMessage", form.translate("form.confirmSensitiveData"))),
        schema: form.schema,
        visibleValues,
        visibleItems,
        onConfirm: confirmSubmission,
        onCancel: cancelSubmission
      }) ?? (
        <>
          <h2>
            {confirmation?.generic === true
              ? form.locale.toLowerCase().startsWith("ja")
                ? "回答内容の確認"
                : "Review your answers"
              : resolveMessage("confirmSensitiveDataTitle")}
          </h2>
          <p>
            {confirmation?.message ??
              (confirmation?.generic === true
                ? form.locale.toLowerCase().startsWith("ja")
                  ? "回答内容をご確認のうえ、送信してください。"
                  : "Please review your answers before submitting."
                : resolveMessage("confirmSensitiveDataMessage", form.translate("form.confirmSensitiveData")))}
          </p>
          {(confirmation?.findings ?? []).length === 0 ? null : (
            <ul>
              {(confirmation?.findings ?? []).map((finding, index) => {
                const field = form.schema.fields.find((candidate) => candidate.id === finding.fieldId);
                const typeLabels: Readonly<Record<string, string>> = form.locale.toLowerCase().startsWith("ja")
                  ? { email: "メールアドレス", phone: "電話番号", url: "URL", postal_code: "郵便番号" }
                  : { email: "Email address", phone: "Phone number", url: "URL", postal_code: "Postal code" };
                const typeLabel = finding.typeLabel ?? typeLabels[finding.type] ?? finding.type;
                const value = maskSensitiveValue(finding);
                return (
                  <li key={`${finding.fieldId}-${finding.type}-${finding.start ?? index}`}>
                    <span>{finding.fieldTitle ?? field?.title ?? finding.fieldId}</span>{" "}
                    <span className="fe-sensitive-type">{typeLabel}</span>
                    {value === undefined ? null : <span className="fe-sensitive-value"> {value}</span>}
                  </li>
                );
              })}
            </ul>
          )}
          {confirmation?.generic === true ? (
            <ul className="fe-submission-summary">
              {visibleItems.map((item) => (
                <li key={item.fieldId}>
                  <span>{item.title}</span>: <span>{item.displayValue}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <button type="button" data-fe-confirm="true" onClick={confirmSubmission}>
            {resolveMessage("confirmButton", form.translate("form.confirmSubmission"))}
          </button>
          <button type="button" onClick={cancelSubmission}>
            {resolveMessage("cancelButton", form.translate("form.cancelSubmission"))}
          </button>
        </>
      )}
    </div>
  );

  if (!receiptLoaded) return null;
  if (receipt !== null) {
    return (
      <div className={`fe-form fe-already-submitted ${className}`.trim()}>
        {slots.renderAlreadySubmitted?.({
          receipt,
          ...(receiptStore === undefined ? {} : { onReset: () => void resetReceipt() })
        }) ?? (
          <div role="status">
            <h2>{resolveMessage("alreadySubmittedTitle")}</h2>
            <p>{resolveMessage("alreadySubmittedMessage", form.translate("form.alreadySubmitted"))}</p>
            {receiptStore === undefined ? null : (
              <button type="button" onClick={() => void resetReceipt()}>
                {resolveMessage("submitButton", form.translate("form.submitAnother"))}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (form.submitStatus === "success" && isReplaceMode) {
    return <div className={`fe-form ${className}`.trim()}>{completionRegion}</div>;
  }

  if (confirmation !== null && confirmationRenderMode === "replace") {
    return <div className={`fe-form ${className}`.trim()}>{confirmationContent}</div>;
  }

  return (
    <>
      <form
        ref={formRef}
        className={`fe-form ${className}`.trim()}
        noValidate
        onSubmit={handleSubmit}
        aria-hidden={confirmation !== null && confirmationRenderMode === "dialog" ? true : undefined}
      >
        {slots.renderHeader?.({
          title: form.schema.title,
          ...(form.schema.description === undefined ? {} : { description: form.schema.description })
        }) ?? (
          <header className="fe-header">
            <h1>{form.schema.title}</h1>
            {form.schema.description === undefined ? null : <p>{form.schema.description}</p>}
            {pages === undefined ? null : (
              <div className="fe-progress">
                <div
                  className="form-progress-bar"
                  role="progressbar"
                  aria-valuemin={1}
                  aria-valuemax={visiblePageIndexes.length}
                  aria-valuenow={activeVisibleIndex + 1}
                >
                  <div
                    className="form-progress-fill"
                    style={{ width: `${((activeVisibleIndex + 1) / visiblePageIndexes.length) * 100}%` }}
                  />
                </div>
                <span>
                  {form.translate("form.step", { current: activeVisibleIndex + 1, total: visiblePageIndexes.length })}
                </span>
              </div>
            )}
            {draftRestored ? <span className="form-draft-badge">{form.translate("form.draftRestored")}</span> : null}
          </header>
        )}
        {activePage === undefined
          ? null
          : (slots.renderPageHeader?.({
              page: activePage,
              pageIndex: activeVisibleIndex,
              totalPages: visiblePageIndexes.length
            }) ?? (
              <div className="fe-page-header">
                {activePage.title === undefined ? null : <h2 className="fe-page-title">{activePage.title}</h2>}
                {activePage.description === undefined ? null : (
                  <p className="fe-page-description">{activePage.description}</p>
                )}
              </div>
            ))}
        {(() => {
          const fieldChildren = form.schema.fields
            .filter((field) => form.visibility[field.id] === true && (fieldIds === undefined || fieldIds.has(field.id)))
            .map((field) => {
              const error = form.errors[field.id];
              const props: FieldComponentProps = {
                field,
                value: form.values[field.id],
                error,
                setValue: (value) => form.setValue(field.id, value),
                translate: fieldTranslate,
                inputId: `${prefix}-${field.id}`,
                errorId: `${prefix}-${field.id}-error`,
                helpId: `${prefix}-${field.id}-help`,
                ...(slots.renderCharacterCount === undefined
                  ? {}
                  : { renderCharacterCount: slots.renderCharacterCount })
              };
              if (slots.renderField !== undefined) {
                return (
                  <Fragment key={field.id}>
                    {slots.renderField({
                      question: field,
                      value: form.values[field.id],
                      onChange: (value) => {
                        if (isFormValue(value)) form.setValue(field.id, value);
                      },
                      ...(error === undefined ? {} : { error })
                    })}
                  </Fragment>
                );
              }
              const Component = components[field.type];
              return Component === undefined ? (
                <DefaultField key={field.id} {...props} />
              ) : (
                <Component key={field.id} {...props} />
              );
            });
          const fieldClassName = `fe-fields${fieldsClassName === undefined ? "" : ` ${fieldsClassName}`}`;
          return (
            slots.renderFields?.({ children: fieldChildren, className: fieldClassName }) ?? (
              <div className={fieldClassName}>{fieldChildren}</div>
            )
          );
        })()}
        {guardMessage === null ? null : <div role="alert">{guardMessage}</div>}
        {confirmation !== null && confirmationRenderMode === "inline" ? confirmationContent : null}
        {validationIssues.length === 0
          ? null
          : (slots.renderValidationSummary?.({ issues: validationIssues }) ?? (
              <div className="fe-validation-summary" role="alert">
                {validationIssues.length} validation error{validationIssues.length === 1 ? "" : "s"}.
              </div>
            ))}
        {pages === undefined ? (
          <>
            {slots.renderNavigation?.({
              currentPage: 0,
              totalPages: 1,
              canPrev: false,
              canNext: false,
              onPrev: () => undefined,
              onNext: () => undefined
            })}
            {renderSubmitButton()}
          </>
        ) : (
          <div className="form-step-navigation">
            {slots.renderNavigation?.({
              currentPage: activeVisibleIndex,
              totalPages: visiblePageIndexes.length,
              canPrev,
              canNext,
              onPrev: () => {
                if (!interactionLocked) setCurrentPageIndex(visiblePageIndexes[activeVisibleIndex - 1] ?? 0);
              },
              onNext: handleNext
            }) ?? (
              <>
                {canPrev ? (
                  <button
                    className="btn-prev"
                    type="button"
                    disabled={interactionLocked}
                    onClick={() => setCurrentPageIndex(visiblePageIndexes[activeVisibleIndex - 1] ?? 0)}
                  >
                    {form.translate("form.back")}
                  </button>
                ) : null}
                {canNext ? (
                  <button className="btn-next" type="button" disabled={interactionLocked} onClick={handleNext}>
                    {form.translate("form.next")}
                  </button>
                ) : null}
              </>
            )}
            {canNext ? null : renderSubmitButton()}
          </div>
        )}
        <div className="fe-status" aria-live="polite">
          {form.submitStatus === "success" ? completionRegion : null}
          {form.submitStatus === "error" && form.submitError !== null
            ? (slots.renderSubmitError?.({ error: form.submitError, onRetry: () => void submitValues() }) ??
              (form.submitError instanceof FormSubmissionError && form.submitError.payload.formError !== undefined ? (
                <div role="alert">
                  {form.submitError.payload.formError}
                  <button type="button" onClick={() => void submitValues()}>
                    {resolveMessage("retryButton")}
                  </button>
                </div>
              ) : (
                <div role="alert">
                  {errorMessageKey === undefined
                    ? resolveMessage("serverErrorSummary")
                    : form.translate(errorMessageKey)}
                  <button type="button" onClick={() => void submitValues()}>
                    {resolveMessage("retryButton")}
                  </button>
                </div>
              )))
            : null}
        </div>
      </form>
      {confirmation !== null && confirmationRenderMode === "dialog" ? (
        <div className="fe-confirmation-dialog-backdrop" role="dialog" aria-modal="true">
          {confirmationContent}
        </div>
      ) : null}
    </>
  );
}

const RENDERER_MESSAGES: Readonly<Record<string, string>> = {
  "form.submit": "Submit",
  "form.back": "Back",
  "form.next": "Next",
  "form.step": "Step {{current}} / {{total}}",
  "form.draftRestored": "Draft restored",
  "form.submissionBlocked": "Submission blocked because sensitive data was detected.",
  "form.confirmSensitiveData": "Sensitive data may be included. Confirm before submitting.",
  "form.confirmSubmission": "Proceed",
  "form.cancelSubmission": "Cancel",
  "form.yes": "Yes",
  "form.no": "No",
  "form.alreadySubmitted": "Already submitted.",
  "form.submitAnother": "Submit another response",
  "validation.required": "This field is required."
};

const RENDERER_MESSAGES_JA: Readonly<Record<string, string>> = {
  "form.submit": "送信する",
  "form.back": "戻る",
  "form.next": "次へ",
  "form.step": "{{current}} / {{total}}",
  "form.draftRestored": "下書きを復元しました",
  "form.submissionBlocked": "個人情報が検出されたため送信できません。",
  "form.confirmSensitiveData": "個人情報が含まれている可能性があります。送信前に確認してください。",
  "form.confirmSubmission": "このまま送信",
  "form.cancelSubmission": "修正する",
  "form.yes": "はい",
  "form.no": "いいえ",
  "form.alreadySubmitted": "回答済みです",
  "form.submitAnother": "別の回答を送信",
  "validation.required": "この項目は必須です"
};

const defaultRendererTranslator: TranslationAdapter = {
  translate(key, locale, params = {}) {
    const localizedMessages = locale.toLowerCase().startsWith("ja") ? RENDERER_MESSAGES_JA : RENDERER_MESSAGES;
    return (localizedMessages[key] ?? key).replace(/\{\{(\w+)\}\}/g, (token, name: string) =>
      Object.hasOwn(params, name) ? String(params[name]) : token
    );
  }
};

export function FormRenderer(props: FormRendererProps) {
  if (!("schema" in props)) return <ContextFormRenderer {...props} />;
  const {
    schema,
    locale = schema.defaultLocale ?? "en",
    translator = defaultRendererTranslator,
    initialValues,
    resetOnSuccess,
    onSubmit,
    ...rendererProps
  } = props;
  return (
    <FormProvider
      schema={schema}
      locale={locale}
      translator={translator}
      onSubmit={onSubmit}
      {...(initialValues === undefined ? {} : { initialValues })}
      {...(resetOnSuccess === undefined ? {} : { resetOnSuccess })}
    >
      <ContextFormRenderer {...rendererProps} />
    </FormProvider>
  );
}
