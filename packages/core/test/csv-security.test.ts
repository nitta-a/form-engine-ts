import { escapeCsvCell, exportResponsesToCsv, type FormSchema, type FormSubmission } from "../src";

describe("CSV formula injection protection", () => {
  it.each(['=HYPERLINK("https://example.test")', "+cmd", "-1+1", "@SUM(A1:A2)"])("neutralizes %s", (value) => {
    expect(escapeCsvCell(value)).toMatch(/^"?'/);
  });

  it.each(["  =1+1", "\t+cmd", "\r-1", "\n@SUM(A1:A2)"])("detects leading whitespace in %j", (value) => {
    const escaped = escapeCsvCell(value);
    expect(escaped.startsWith("'") || escaped.startsWith("\"'")).toBe(true);
  });

  it("can disable neutralization without changing RFC 4180 escaping or the BOM option", () => {
    expect(escapeCsvCell("-50", false)).toBe("-50");
    expect(escapeCsvCell('a,"b"', false)).toBe('"a,""b"""');

    const schema: FormSchema = {
      id: "csv",
      version: 1,
      title: "CSV",
      fields: [{ id: "value", type: "text", title: "Value", required: false }]
    };
    const response: FormSubmission = {
      id: "response",
      formId: "csv",
      formVersion: 1,
      locale: "en",
      values: { value: "-50" },
      submittedAt: "2026-08-24T00:00:00.000Z"
    };
    expect(exportResponsesToCsv(schema, [response], { withBom: false })).toContain("'-50");
    expect(exportResponsesToCsv(schema, [response], { withBom: false, neutralizeFormulas: false })).toContain("-50");
  });
});
