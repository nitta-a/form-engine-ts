import type { FormSchema } from "@form-engine-ts/core";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import "@form-engine-ts/react/styles.css";
import { MuiBuilderNavigator } from "../src/MuiBuilderNavigator";
import { MuiBuilderPreview } from "../src/MuiBuilderPreview";
import { MuiBuilderValidationSummary } from "../src/MuiBuilderValidationSummary";
import { MuiFormBuilder } from "../src/MuiFormBuilder";

const schema: FormSchema = {
  id: "builder-ux",
  version: 1,
  title: "Builder UX",
  defaultLocale: "en",
  fields: [
    { id: "age", type: "number", title: "Age", required: false, min: 1 },
    { id: "notes", type: "text", title: "Notes", required: false }
  ],
  pages: [
    { id: "about", title: "About", questionIds: ["age"] },
    { id: "feedback", title: "Feedback", questionIds: ["notes"] }
  ]
};

describe("MUI builder UX", () => {
  it("progressively discloses advanced field settings without changing the schema", async () => {
    const user = userEvent.setup();
    let current = schema;
    const onChange = (next: FormSchema) => {
      current = next;
    };
    render(
      <MuiFormBuilder
        schema={current}
        onChange={onChange}
        features={{ localization: false, conditions: false }}
        pageEditorMode="single"
        selectedPageId="about"
      />
    );

    const advanced = screen.getByRole("button", { name: "Advanced" });
    expect(screen.getByLabelText("Minimum")).not.toBeVisible();
    const before = JSON.stringify(current);
    await user.click(advanced);
    expect(screen.getByLabelText("Minimum")).toBeVisible();
    expect(JSON.stringify(current)).toBe(before);

    fireEvent.change(screen.getByLabelText("Minimum"), { target: { value: "2" } });
    expect(current.fields[0]).toMatchObject({ id: "age", min: 2 });
  });

  it("keeps choice-specific advanced settings on the existing field action path", async () => {
    const user = userEvent.setup();
    const { pages: _pages, ...schemaWithoutPages } = schema;
    const initial: FormSchema = {
      ...schemaWithoutPages,
      fields: [
        {
          id: "choice",
          type: "radio",
          title: "Choice",
          required: false,
          options: [
            { id: "one", label: "One" },
            { id: "two", label: "Two" }
          ]
        }
      ]
    };
    function ChoiceHarness() {
      const [current, setCurrent] = useState(initial);
      return <MuiFormBuilder schema={current} onChange={setCurrent} />;
    }
    render(<ChoiceHarness />);

    await user.click(screen.getByRole("button", { name: "Advanced" }));
    const shuffle = screen.getByRole("checkbox", { name: "Shuffle options for respondents" });
    await user.click(shuffle);
    expect(shuffle).toBeChecked();
    await user.click(shuffle);
    expect(shuffle).not.toBeChecked();
  });

  it("navigates page and field hierarchy with keyboard-accessible buttons", async () => {
    const user = userEvent.setup();
    const onFieldChange = vi.fn();
    const onPageChange = vi.fn();
    render(
      <MuiBuilderNavigator
        schema={schema}
        activeFieldId="age"
        selectedPageId="about"
        onActiveFieldChange={onFieldChange}
        onSelectedPageChange={onPageChange}
      />
    );

    const feedback = screen.getByRole("button", { name: "Feedback" });
    await user.click(feedback);
    expect(onPageChange).toHaveBeenCalledWith("feedback");
    expect(onFieldChange).toHaveBeenCalledWith("notes");
    await user.click(feedback);
    await user.click(screen.getByRole("button", { name: "Notes" }));
    expect(onFieldChange).toHaveBeenCalledWith("notes");
    feedback.focus();
    await user.keyboard("{Enter}");
    expect(onPageChange).toHaveBeenCalledTimes(3);
  });

  it("renders the real renderer in a non-persisting preview wrapper", () => {
    const { pages: _pages, ...schemaWithoutPages } = schema;
    render(<MuiBuilderPreview schema={schemaWithoutPages} />);
    expect(document.querySelector('[data-mui-slot="builder-preview"]')).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Builder UX" })).toBeInTheDocument();
    expect(screen.getByLabelText("Age")).toBeInTheDocument();
  });

  it("resolves validation paths to field navigation targets", async () => {
    const user = userEvent.setup();
    const onFieldSelect = vi.fn();
    const onPageSelect = vi.fn();
    render(
      <MuiBuilderValidationSummary
        schema={schema}
        validationState={{
          mode: "survey",
          valid: false,
          issues: [
            { source: "schema", path: "fields[1].title", code: "required", message: "A title is required." },
            { source: "schema", path: "pages[0].title", code: "invalid", message: "The page is invalid." },
            { source: "schema", path: "form", code: "invalid", message: "The form is invalid." }
          ]
        }}
        onFieldSelect={onFieldSelect}
        onPageSelect={onPageSelect}
      />
    );

    expect(screen.getByText("Notes")).toBeInTheDocument();
    const fixButtons = screen.getAllByRole("button", { name: "Fix" });
    expect(fixButtons).toHaveLength(2);
    const fieldFixButton = fixButtons[0];
    const pageFixButton = fixButtons[1];
    if (fieldFixButton === undefined || pageFixButton === undefined) throw new Error("Expected fix buttons.");
    await user.click(fieldFixButton);
    expect(onFieldSelect).toHaveBeenCalledWith("notes");
    await user.click(pageFixButton);
    expect(onPageSelect).toHaveBeenCalledWith("about");
  });
});
