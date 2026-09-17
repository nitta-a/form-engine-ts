import { type FieldOption, shuffleOptions } from "../src";

const options: readonly FieldOption[] = [
  { id: "a", label: "A" },
  { id: "pinned", label: "Pinned", pinned: true },
  { id: "b", label: "B" },
  { id: "c", label: "C" }
];

describe("shuffleOptions", () => {
  it("returns the same order for the same seed", () => {
    expect(shuffleOptions(options, "respondent-1")).toEqual(shuffleOptions(options, "respondent-1"));
  });

  it("keeps pinned options at their original positions", () => {
    const ordered = shuffleOptions(options, "respondent-2");
    expect(ordered[1]?.id).toBe("pinned");
    expect(ordered.map((option) => option.id).sort()).toEqual(["a", "b", "c", "pinned"]);
  });

  it("does not mutate the source array and handles empty options", () => {
    expect(shuffleOptions(options, "respondent-3")).not.toBe(options);
    expect(shuffleOptions([], "respondent-3")).toEqual([]);
  });
});
