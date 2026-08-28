import { mockTranslator } from "@form-engine-ts/translator-mock";
import { useState } from "react";

export interface ResetResponsesControlProps {
  readonly locale: string;
  readonly disabled: boolean;
  readonly onReset: () => Promise<void>;
}

export function ResetResponsesControl({ locale, disabled, onReset }: ResetResponsesControlProps) {
  const [confirming, setConfirming] = useState(false);
  const t = (key: string) => mockTranslator.translate(key, locale) ?? key;
  if (!confirming) {
    return (
      <button className="danger-action" type="button" disabled={disabled} onClick={() => setConfirming(true)}>
        {t("preview.resetResponses")}
      </button>
    );
  }
  return (
    <fieldset className="reset-confirmation">
      <legend>{t("preview.resetConfirmation")}</legend>
      <button
        className="danger-action"
        type="button"
        disabled={disabled}
        onClick={async () => {
          await onReset();
          setConfirming(false);
        }}
      >
        {t("preview.confirmReset")}
      </button>
      <button type="button" disabled={disabled} onClick={() => setConfirming(false)}>
        {t("preview.cancel")}
      </button>
    </fieldset>
  );
}
