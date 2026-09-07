import {
  contentMetadataToJson,
  createInitialSchemaByMode,
  type FormSchema,
  getContentModePolicy,
  readQuizFieldMetadata,
  validateContentMode
} from "@form-engine-ts/core";
import { SurveyEditor } from "@form-engine-ts/custom-survey-client";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { createMuiBuilderProps } from "../src/builderProps";
import { ContentModeSettings } from "../src/ContentModeSettings";
import { QuizFieldEditor, QuizOptionEditor } from "../src/QuizEditorSlots";

const preset = createInitialSchemaByMode("quiz", { title: "Quiz", locale: "en" });
const builder = createMuiBuilderProps(
  {},
  { slots: { optionEditorAfter: QuizOptionEditor, fieldEditorAfter: QuizFieldEditor } }
);

function Editor() {
  const [schema, setSchema] = useState<FormSchema>({
    ...preset,
    metadata: contentMetadataToJson({ mode: "quiz", quiz: { showExplanation: "after_submit", extra: "keep" } })
  });
  return (
    <>
      <SurveyEditor
        schema={schema}
        onChange={setSchema}
        policy={getContentModePolicy("quiz")}
        {...(builder.components === undefined ? {} : { components: builder.components })}
        {...(builder.slots === undefined ? {} : { builderSlots: builder.slots })}
        adapter={{ updateSurveyDraft: async () => {}, translateSurveyPreview: async ({ schema: next }) => next }}
        slots={{
          responseSettings: ({ schema: next, onChange }) => (
            <ContentModeSettings schema={next} {...(onChange ? { onChange } : {})} />
          )
        }}
      />
      <output data-testid="schema">{JSON.stringify(schema)}</output>
      <output data-testid="issues">
        {validateContentMode(schema)
          .map((issue) => issue.message)
          .join(" ")}
      </output>
    </>
  );
}
describe("MUI content slots", () => {
  it("composes with the MUI field editor and retains metadata while updating settings", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole("radio", { name: "Correct answer: Option 1" }));
    expect(screen.getByRole("radio", { name: "Correct answer: Option 1" })).toBeChecked();
    await user.type(screen.getByLabelText("Explanation"), "Helpful fact");
    await user.type(screen.getByLabelText("Passing score"), "1");
    expect(screen.getByTestId("schema")).toHaveTextContent('"extra":"keep"');
    expect(screen.getByTestId("schema")).toHaveTextContent('"explanation":"Helpful fact"');
    await user.clear(screen.getByLabelText("Passing score"));
    expect(screen.getByTestId("schema")).not.toHaveTextContent("passingScore");
    expect(screen.getByTestId("issues")).toBeEmptyDOMElement();
    await user.click(screen.getByRole("button", { name: "Delete Option 1" }));
    await waitFor(() => expect(screen.getByTestId("issues")).toHaveTextContent("Select a correct option."));
    expect(screen.getByRole("radio", { name: "Correct answer: Option 2" })).not.toBeChecked();
  });
  it("reads absent quiz settings as an unset correct answer", () => {
    expect(readQuizFieldMetadata(undefined)).toEqual({ correctOptionId: "" });
  });
});
