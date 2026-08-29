import type { FormSchema } from "@form-engine-ts/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { TranslationComparisonWorkspace } from "../src";

const schema: FormSchema = {
  id: "mui-comparison",
  version: 1,
  title: "Customer survey",
  defaultLocale: "en",
  supportedLocales: ["en", "ja"],
  fields: [{ id: "name", type: "text", title: "Name", required: false }]
};

describe("TranslationComparisonWorkspace", () => {
  it("renders source and translation columns with a read-only source", () => {
    render(<TranslationComparisonWorkspace schema={schema} targetLocale="ja" i18n={{ locale: "en" }} />);

    const row = screen.getByTestId("translation-comparison-row-form-title");
    expect(row).toHaveStyle({ display: "grid" });
    expect(screen.getByText("Customer survey")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox", { name: /Translation/u })).toHaveLength(2);
    expect(screen.queryByRole("textbox", { name: /Customer survey/u })).not.toBeInTheDocument();
  });

  it("passes edited translation schema to the parent", () => {
    const onChange = vi.fn();
    render(
      <TranslationComparisonWorkspace schema={schema} targetLocale="ja" onChange={onChange} i18n={{ locale: "en" }} />
    );

    fireEvent.change(screen.getByRole("textbox", { name: /Translation.*Title/u }), {
      target: { value: "顧客アンケート" }
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ translations: { ja: { title: "顧客アンケート" } } })
    );
  });
});
