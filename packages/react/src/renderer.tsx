import {
  type FieldType,
  type FormField,
  type FormValue,
  type ValidationIssue,
  validateAnswers
} from "@form-engine-ts/core";
import { type ComponentType, type FormEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { useForm } from "./context";

export interface FieldComponentProps {
  readonly field: FormField;
  readonly value: FormValue;
  readonly error: ValidationIssue | undefined;
  readonly setValue: (value: FormValue) => void;
  readonly translate: (key: string, params?: Readonly<Record<string, string | number>>) => string;
  readonly inputId: string;
  readonly errorId: string;
  readonly helpId: string;
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
  if (field.type === "textarea") {
    control = (
      <textarea
        {...ariaProps}
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
      <FieldMessage props={props} />
    </div>
  );
}

export interface FormRendererProps {
  readonly components?: FieldComponents;
  readonly className?: string;
  readonly successMessageKey?: string;
  readonly errorMessageKey?: string;
  readonly autoSaveKey?: string;
}

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

export function FormRenderer({
  components = {},
  className = "",
  successMessageKey,
  errorMessageKey,
  autoSaveKey
}: FormRendererProps) {
  const form = useForm();
  const prefix = useId().replace(/:/g, "");
  const formRef = useRef<HTMLFormElement>(null);
  const loadedDraftKey = useRef<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [focusFieldId, setFocusFieldId] = useState<string | null>(null);
  const pages = form.schema.pages;
  const visiblePageIndexes = useMemo(
    () =>
      pages === undefined ? [] : pages.flatMap((page, index) => (form.pageVisibility[page.id] === true ? [index] : [])),
    [form.pageVisibility, pages]
  );
  const activePage = pages?.[currentPageIndex];
  const activeVisibleIndex = visiblePageIndexes.indexOf(currentPageIndex);
  const fieldIds = activePage === undefined ? undefined : new Set(activePage.questionIds);

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
      control.focus();
      setFocusFieldId(null);
    }
  }, [focusFieldId]);

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
    if (autoSaveKey === undefined || typeof globalThis.localStorage === "undefined") return;
    if (form.submitStatus === "success") return;
    const timeout = globalThis.setTimeout(() => {
      const draft: StoredDraft = {
        formId: form.schema.id,
        formVersion: form.schema.version,
        values: form.values,
        savedAt: new Date().toISOString()
      };
      globalThis.localStorage.setItem(autoSaveKey, JSON.stringify(draft));
    }, 500);
    return () => globalThis.clearTimeout(timeout);
  }, [autoSaveKey, form.schema.id, form.schema.version, form.submitStatus, form.values]);

  const focusFirstIssue = (fieldId: string | undefined) => {
    if (fieldId !== undefined) setFocusFieldId(fieldId);
  };

  const handleNext = () => {
    const result = form.validatePage(currentPageIndex);
    if (!result.valid) {
      focusFirstIssue(result.issues[0]?.fieldId);
      return;
    }
    const nextPageIndex = visiblePageIndexes[activeVisibleIndex + 1];
    if (nextPageIndex !== undefined) setCurrentPageIndex(nextPageIndex);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateAnswers(form.schema, form.values);
    const firstInvalidFieldId = validation.issues[0]?.fieldId;
    const valid = await form.submit();
    if (!valid) {
      const invalidPageIndex = pages?.findIndex((page) =>
        firstInvalidFieldId === undefined ? false : page.questionIds.includes(firstInvalidFieldId)
      );
      if (invalidPageIndex !== undefined && invalidPageIndex >= 0) setCurrentPageIndex(invalidPageIndex);
      focusFirstIssue(firstInvalidFieldId);
      return;
    }
    if (autoSaveKey !== undefined && typeof globalThis.localStorage !== "undefined") {
      globalThis.localStorage.removeItem(autoSaveKey);
      setDraftRestored(false);
    }
    setCurrentPageIndex(visiblePageIndexes[0] ?? 0);
  };

  return (
    <form ref={formRef} className={`fe-form ${className}`.trim()} noValidate onSubmit={handleSubmit}>
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
      {activePage?.title === undefined ? null : <h2 className="fe-page-title">{activePage.title}</h2>}
      {activePage?.description === undefined ? null : <p className="fe-page-description">{activePage.description}</p>}
      <div className="fe-fields">
        {form.schema.fields
          .filter((field) => form.visibility[field.id] === true && (fieldIds === undefined || fieldIds.has(field.id)))
          .map((field) => {
            const props: FieldComponentProps = {
              field,
              value: form.values[field.id],
              error: form.errors[field.id],
              setValue: (value) => form.setValue(field.id, value),
              translate: form.translate,
              inputId: `${prefix}-${field.id}`,
              errorId: `${prefix}-${field.id}-error`,
              helpId: `${prefix}-${field.id}-help`
            };
            const Component = components[field.type];
            return Component === undefined ? (
              <DefaultField key={field.id} {...props} />
            ) : (
              <Component key={field.id} {...props} />
            );
          })}
      </div>
      {pages === undefined ? (
        <button className="fe-submit" type="submit" disabled={form.isSubmitting}>
          {form.translate(form.schema.submitLabelKey ?? "form.submit")}
        </button>
      ) : (
        <div className="form-step-navigation">
          {activeVisibleIndex > 0 ? (
            <button
              className="btn-prev"
              type="button"
              onClick={() => setCurrentPageIndex(visiblePageIndexes[activeVisibleIndex - 1] ?? 0)}
            >
              {form.translate("form.back")}
            </button>
          ) : null}
          {activeVisibleIndex < visiblePageIndexes.length - 1 ? (
            <button className="btn-next" type="button" onClick={handleNext}>
              {form.translate("form.next")}
            </button>
          ) : (
            <button className="fe-submit" type="submit" disabled={form.isSubmitting}>
              {form.translate(form.schema.submitLabelKey ?? "form.submit")}
            </button>
          )}
        </div>
      )}
      <div className="fe-status" aria-live="polite">
        {form.submitStatus === "success" && successMessageKey !== undefined ? (
          <div role="status">{form.translate(successMessageKey)}</div>
        ) : null}
        {form.submitStatus === "error" && form.submitError !== null && errorMessageKey !== undefined ? (
          <div role="alert">{form.translate(errorMessageKey)}</div>
        ) : null}
      </div>
    </form>
  );
}
