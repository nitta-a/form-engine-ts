import { calculateProgress, type FormSchema } from "../src";

describe("calculateProgress", () => {
  const schema: FormSchema = {
    id: "progress",
    version: 1,
    title: "Progress",
    fields: [
      { id: "showDetails", type: "checkbox", title: "Show details", required: false },
      { id: "name", type: "text", title: "Name", required: true },
      {
        id: "details",
        type: "textarea",
        title: "Details",
        required: false,
        displayCondition: { questionId: "showDetails", operator: "equals", value: true }
      }
    ],
    pages: [
      { id: "first", title: "First", questionIds: ["showDetails", "name"] },
      {
        id: "second",
        title: "Second",
        questionIds: ["details"],
        displayCondition: { questionId: "showDetails", operator: "equals", value: true }
      }
    ]
  };

  it("counts only visible questions and pages", () => {
    expect(calculateProgress(schema, { showDetails: false, name: "A" }, 0)).toEqual({
      visiblePages: 1,
      currentPage: 0,
      answeredVisibleQuestions: 1,
      totalVisibleQuestions: 2,
      remainingQuestions: 1,
      percent: 50
    });
  });

  it("includes conditional pages and questions when their condition is met", () => {
    expect(calculateProgress(schema, { showDetails: true }, 1)).toMatchObject({
      visiblePages: 2,
      currentPage: 1,
      answeredVisibleQuestions: 1,
      totalVisibleQuestions: 3,
      remainingQuestions: 2,
      percent: 33
    });
  });
});
