import type { FormSchema } from "@form-engine-ts/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FormBuilder } from "../src/builder";
import type { BuilderBasicSettingsSlotProps } from "../src/types";

const schema: FormSchema = {
  id: "settings",
  version: 1,
  title: "Original",
  defaultLocale: "en",
  supportedLocales: ["en"],
  fields: []
};
function Settings({ schema, locale, readOnly, onChange, components, translate }: BuilderBasicSettingsSlotProps) {
  const { Button } = components;
  return (
    <Button disabled={readOnly} onClick={() => onChange?.({ ...schema, title: locale })}>
      {translate("builder.content.pollSettings")}
    </Button>
  );
}
describe("basicSettingsAfter", () => {
  it("receives the controlled schema, locale, components and translator", () => {
    const onChange = vi.fn();
    render(<FormBuilder schema={schema} onChange={onChange} locale="ja" slots={{ basicSettingsAfter: Settings }} />);
    fireEvent.click(screen.getByRole("button", { name: "投票設定" }));
    expect(onChange).toHaveBeenCalledWith({ ...schema, title: "ja" });
  });
  it("passes readOnly and renders on the server", () => {
    render(<FormBuilder schema={schema} onChange={() => {}} readOnly slots={{ basicSettingsAfter: Settings }} />);
    expect(screen.getByRole("button", { name: "Poll settings" })).toBeDisabled();
    expect(
      renderToString(<FormBuilder schema={schema} onChange={() => {}} slots={{ basicSettingsAfter: Settings }} />)
    ).toContain("Poll settings");
  });
});
