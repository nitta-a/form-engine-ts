import type { FormSchema } from "@form-engine-ts/core";
import { render, screen } from "@testing-library/react";
import { FormBuilder, FormEngineI18nProvider } from "../src";

const schema: FormSchema = {
  id: "provider-schema",
  version: 1,
  title: "Survey",
  defaultLocale: "en",
  supportedLocales: ["zh-Hans", "ko"],
  fields: [{ id: "name", type: "text", title: "Name", required: false }]
};

describe("FormEngineI18nProvider", () => {
  it("localizes builder UI without changing schema locales", () => {
    render(
      <FormEngineI18nProvider locale="ja">
        <FormBuilder schema={schema} onChange={() => undefined} features={{ pages: false, localization: false }} />
      </FormEngineI18nProvider>
    );

    expect(screen.getByRole("button", { name: "質問を追加" })).toBeInTheDocument();
    expect(schema.defaultLocale).toBe("en");
    expect(schema.supportedLocales).toEqual(["zh-Hans", "ko"]);
  });
});
