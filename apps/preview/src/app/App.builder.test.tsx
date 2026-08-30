import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { clearPreviewStorage } from "./app-test-helpers";

describe("preview application builder workspaces", () => {
  beforeEach(clearPreviewStorage);

  it("localizes form builder controls when Japanese is selected", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "日本語" }));

    expect(screen.getByRole("region", { name: "フォームビルダー" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "質問を追加" })).toBeInTheDocument();
    expect(screen.getAllByLabelText("種類")).not.toHaveLength(0);
    expect(screen.getAllByText("必須")).not.toHaveLength(0);
    expect(screen.getByLabelText("完了メッセージ")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add question" })).not.toBeInTheDocument();
  });

  it("opens the MUI mode preview with MUI controls", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: "MUI Mode" }));

    const panel = screen.getByRole("tabpanel", { name: "MUI Mode" });
    expect(panel).toBeVisible();
    expect(panel.querySelector("#builder-form-title")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Add question" })).toBeInTheDocument();
  });

  it("opens the source and translation comparison workspace", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: "Translation Comparison" }));

    const panel = screen.getByRole("tabpanel", { name: "Translation Comparison" });
    expect(panel).toBeVisible();
    expect(
      within(panel).getByRole("heading", { name: "Translation comparison workspace", level: 6 })
    ).toBeInTheDocument();
    expect(within(panel).getAllByRole("textbox").length).toBeGreaterThan(0);
  });

  it("runs the translation overwrite policy and displays its report", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Overwrite"), { target: { value: "all" } });
    const runTranslation = screen.getByRole("button", { name: "Run translation policy" });
    await waitFor(() => expect(runTranslation).toBeEnabled());
    fireEvent.click(runTranslation);
    await waitFor(() =>
      expect(document.querySelector(".translation-policy-demo output")).toHaveTextContent(
        /updated \/ 0 skipped \(all\)/
      )
    );
    await waitFor(() => expect(document.querySelector(".json-card code")).toHaveTextContent('"translationMetadata"'));
  });

  it("demonstrates headless factory actions with Core and React policy parity", async () => {
    const user = userEvent.setup();
    render(<App />);
    const parity = screen.getByTestId("policy-parity");
    const match = parity.textContent?.match(/Core (\d+) \/ React (\d+)/);
    expect(match?.[1]).toBe(match?.[2]);
    await user.click(screen.getByRole("button", { name: "Add via headless factory" }));
    expect(await screen.findByRole("group", { name: "Headless-created question" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Set completion via headless action" }));
    await waitFor(() =>
      expect(document.querySelector(".json-card code")).toHaveTextContent("Updated via headless action")
    );
  });

  it("simulates draft publication and incremental analytics", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText("Incremental submissions: 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clone published version to draft" }));
    expect(screen.getByText("Draft v2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Publish draft" }));
    expect(await screen.findByText("Published v2; archived v1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Run concurrent CAS simulation" }));
    expect(await screen.findByText("CAS: 1 success / 1 revision_conflict")).toBeInTheDocument();
  });

  it("demonstrates Visual Builder defaults and manual translation metadata", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Add question" }));
    const added = screen.getByRole("group", { name: "New question" });
    expect(within(added).getByLabelText("Type")).toHaveValue("textarea");

    await user.selectOptions(screen.getByLabelText("Edit locale"), "en");
    const localizedCompletion = screen.getAllByLabelText("Completion message")[1];
    if (localizedCompletion === undefined) throw new Error("Expected localized completion editor");
    await user.type(localizedCompletion, "!");
    await waitFor(() => expect(document.querySelector(".json-card code")).toHaveTextContent("preview-manual"));
  }, 30000);

  it("demonstrates read-only and feature-scoped builder modes", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("Read-only builder"));
    expect(screen.getByRole("button", { name: "Add question" })).toBeDisabled();
    await user.click(screen.getByLabelText("Pages feature"));
    await user.click(screen.getByLabelText("Localization feature"));
    await user.click(screen.getByLabelText("Conditions feature"));
    expect(screen.queryByRole("heading", { name: "Page manager" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Localization" })).not.toBeInTheDocument();
    expect(screen.queryAllByLabelText("Display condition")).toHaveLength(0);
  }, 30000);

  it("demonstrates injected Builder primitives and the ARGS translation action slot", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("Use custom Builder UI"));
    expect(screen.getByRole("button", { name: "Add question" })).toHaveClass("preview-mui-button");
    expect(screen.getAllByLabelText("Page title")[0]).toHaveClass("preview-mui-input");
    expect(screen.queryByRole("button", { name: "Translate all text" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run ARGS AI translation" })).toBeInTheDocument();
  });
});
