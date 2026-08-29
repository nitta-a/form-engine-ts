import type { FormSchema } from "@form-engine-ts/core";
import { FormEngineI18nProvider } from "@form-engine-ts/react";
import { render, screen } from "@testing-library/react";
import { MuiFormBuilder } from "../src/MuiFormBuilder";

const schema: FormSchema = {
  id: "mui-provider-schema",
  version: 1,
  title: "Survey",
  defaultLocale: "en",
  supportedLocales: ["zh-Hans", "ko"],
  fields: [{ id: "name", type: "text", title: "Name", required: false }]
};

describe("MUI i18n provider integration", () => {
  it("uses the UI locale without changing schema locales", () => {
    render(
      <FormEngineI18nProvider locale="ja">
        <MuiFormBuilder schema={schema} onChange={() => undefined} features={{ pages: false, localization: false }} />
      </FormEngineI18nProvider>
    );

    expect(screen.getByRole("button", { name: "質問を追加" })).toBeInTheDocument();
    expect(schema.defaultLocale).toBe("en");
    expect(schema.supportedLocales).toEqual(["zh-Hans", "ko"]);
  });

  it("constructs the provider from MuiFormBuilder i18n options", () => {
    render(
      <MuiFormBuilder
        schema={schema}
        onChange={() => undefined}
        i18n={{ locale: "ja" }}
        features={{ pages: false, localization: false }}
      />
    );

    expect(screen.getByRole("button", { name: "質問を追加" })).toBeInTheDocument();
  });
});
