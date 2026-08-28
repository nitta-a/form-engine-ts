import { mockTranslator } from "@form-engine-ts/translator-mock";

import type { StorageKind } from "../workspace/PreviewWorkspaceContext";

export interface StorageSwitchProps {
  readonly value: StorageKind;
  readonly locale: string;
  readonly onChange: (value: StorageKind) => void;
}

export function StorageSwitch({ value, locale, onChange }: StorageSwitchProps) {
  const t = (key: string) => mockTranslator.translate(key, locale) ?? key;
  return (
    <fieldset className="storage-switch">
      <legend>{t("preview.storage")}</legend>
      <label>
        <input type="radio" name="storage" checked={value === "memory"} onChange={() => onChange("memory")} />
        {t("preview.memory")}
      </label>
      <label>
        <input type="radio" name="storage" checked={value === "local"} onChange={() => onChange("local")} />
        {t("preview.localStorage")}
      </label>
    </fieldset>
  );
}
