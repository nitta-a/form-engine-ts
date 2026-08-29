import { commitVersionTransition, type FormVersionTransitionPlan } from "../src";

describe("domain data in version transitions", () => {
  it("passes opaque domain data through every transition phase", async () => {
    const domainData = { deckId: "deck_123", branchRules: ["review-required"] };
    const plan: FormVersionTransitionPlan = {
      formId: "guide",
      expectedRevision: 4,
      nextRevision: 5,
      events: [],
      timestamp: "2026-08-29T00:00:00.000Z",
      schema: {
        id: "guide",
        version: 2,
        title: "Guide",
        fields: []
      }
    };
    const seen: unknown[] = [];

    const result = await commitVersionTransition({
      context: { formId: "guide", fromVersion: 1, toVersion: 2, expectedRevision: 4, plan, domainData },
      beforeTransition: async (context) => {
        seen.push(context.domainData);
        return context.domainData;
      },
      persistAdapter: async ({ domainData: persisted }) => {
        seen.push(persisted);
        return { nextRevision: 5 };
      },
      afterTransition: async (context) => {
        seen.push(context.domainData);
      }
    });

    expect(result).toEqual({ success: true, nextRevision: 5 });
    expect(seen).toEqual([domainData, domainData, domainData]);
  });
});
