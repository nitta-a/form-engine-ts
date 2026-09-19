import type { FormInteractionEvent, FormSchema } from "@form-engine-ts/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { FormRenderer } from "../src";

const schema: FormSchema = {
  id: "telemetry-form",
  version: 1,
  title: "Telemetry form",
  fields: [
    { id: "first", type: "text", title: "First", required: true },
    { id: "second", type: "text", title: "Second", required: true }
  ],
  pages: [
    { id: "page-1", title: "Page 1", questionIds: ["first"] },
    { id: "page-2", title: "Page 2", questionIds: ["second"] }
  ]
};

const { pages: _pages, ...singlePageBase } = schema;
const singlePageSchema: FormSchema = { ...singlePageBase, fields: schema.fields.slice(0, 1) };

const conditionalSchema: FormSchema = {
  id: "conditional-telemetry-form",
  version: 1,
  title: "Conditional telemetry form",
  fields: [
    {
      id: "show",
      type: "select",
      title: "Show details",
      required: false,
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" }
      ]
    },
    {
      id: "details",
      type: "text",
      title: "Details",
      required: false,
      displayCondition: { questionId: "show", operator: "equals", value: "yes" }
    }
  ]
};

function adapterFor(events: FormInteractionEvent[], fail = false) {
  return {
    track(event: FormInteractionEvent) {
      events.push(event);
      if (fail) return Promise.reject(new Error("telemetry unavailable"));
    }
  };
}

describe("FormRenderer telemetry", () => {
  it("records view, focus, start, completion, and privacy-safe events once in StrictMode", async () => {
    const user = userEvent.setup();
    const events: FormInteractionEvent[] = [];
    render(
      <StrictMode>
        <FormRenderer
          schema={singlePageSchema}
          onSubmit={() => undefined}
          telemetry={{ adapter: adapterFor(events) }}
        />
      </StrictMode>
    );

    await waitFor(() => expect(events.filter((event) => event.type === "form.viewed")).toHaveLength(1));
    expect(events.some((event) => event.type === "form.started")).toBe(false);

    const input = screen.getByLabelText(/First/);
    await user.click(input);
    expect(events.some((event) => event.type === "form.started")).toBe(false);
    expect(events.filter((event) => event.type === "field.focused")).toHaveLength(1);

    await user.type(input, "山田太郎");
    await waitFor(() => expect(events.some((event) => event.type === "field.completed")).toBe(true));
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("山田太郎");
    expect(serialized).not.toContain("First");
    expect(serialized).not.toMatch(/"(value|values|answer|answers|rawValue)"/);
    expect(events.every((event) => event.eventVersion === 1)).toBe(true);
  });

  it("records page validation and successful navigation", async () => {
    const user = userEvent.setup();
    const events: FormInteractionEvent[] = [];
    render(
      <StrictMode>
        <FormRenderer schema={schema} onSubmit={() => undefined} telemetry={{ adapter: adapterFor(events) }} />
      </StrictMode>
    );

    await waitFor(() =>
      expect(events.some((event) => event.type === "page.viewed" && event.pageId === "page-1")).toBe(true)
    );
    expect(events.filter((event) => event.type === "page.viewed" && event.pageId === "page-1")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(events.some((event) => event.type === "validation.failed")).toBe(true));
    expect(events.some((event) => event.type === "page.completed")).toBe(false);

    await user.type(screen.getByLabelText(/First/), "Ada");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(events.some((event) => event.type === "page.completed")).toBe(true));
    expect(events.some((event) => event.type === "page.viewed" && event.pageId === "page-2")).toBe(true);
  });

  it("isolates adapter failures from input and submission", async () => {
    const user = userEvent.setup();
    const events: FormInteractionEvent[] = [];
    const errors: unknown[] = [];
    render(
      <FormRenderer
        schema={singlePageSchema}
        onSubmit={() => undefined}
        telemetry={{ adapter: adapterFor(events, true), onError: (error) => errors.push(error) }}
      />
    );

    await user.type(screen.getByLabelText(/First/), "Ada");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(events.some((event) => event.type === "form.submitted")).toBe(true));
    expect(errors.length).toBeGreaterThan(0);
    expect(screen.getByRole("status")).toHaveTextContent("Submitted.");
  });

  it("records submit failures without exposing the error message", async () => {
    const user = userEvent.setup();
    const events: FormInteractionEvent[] = [];
    render(
      <FormRenderer
        schema={singlePageSchema}
        onSubmit={async () => {
          throw new Error("secret server response");
        }}
        telemetry={{ adapter: adapterFor(events) }}
      />
    );

    await user.type(screen.getByLabelText(/First/), "Ada");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(events.some((event) => event.type === "form.submit_failed")).toBe(true));
    expect(JSON.stringify(events)).not.toContain("secret server response");
  });

  it("tracks conditional fields only after they become visible", async () => {
    const user = userEvent.setup();
    const events: FormInteractionEvent[] = [];
    render(
      <FormRenderer schema={conditionalSchema} onSubmit={() => undefined} telemetry={{ adapter: adapterFor(events) }} />
    );

    await waitFor(() => expect(screen.getByLabelText("Show details")).toBeInTheDocument());
    expect(events.some((event) => event.type === "field.presented" && event.fieldId === "details")).toBe(false);

    await user.selectOptions(screen.getByLabelText("Show details"), "yes");
    await waitFor(() =>
      expect(events.filter((event) => event.type === "field.presented" && event.fieldId === "details")).toHaveLength(1)
    );

    await user.selectOptions(screen.getByLabelText("Show details"), "no");
    await user.selectOptions(screen.getByLabelText("Show details"), "yes");
    expect(events.filter((event) => event.type === "field.presented" && event.fieldId === "details")).toHaveLength(1);
  });
});
