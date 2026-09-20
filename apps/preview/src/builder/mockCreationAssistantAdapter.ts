import type { CreationAssistantAdapter, SurveyCreationBrief } from "@form-engine-ts/core";

export const mockCreationAssistantAdapter: CreationAssistantAdapter = {
  async respond({ latestMessage, brief }, signal) {
    if (signal?.aborted) throw new DOMException("The request was cancelled.", "AbortError");
    const nextBrief: SurveyCreationBrief =
      brief.purpose === undefined
        ? { ...brief, purpose: latestMessage }
        : brief.audience === undefined
          ? { ...brief, audience: latestMessage }
          : { ...brief, goals: [...(brief.goals ?? []), latestMessage] };
    if (nextBrief.audience === undefined)
      return {
        type: "clarification",
        message: "誰から回答を集めたいですか？",
        brief: nextBrief,
        missing: ["audience"],
        suggestions: [
          { id: "employees", label: "社員", value: "社員" },
          { id: "customers", label: "顧客", value: "顧客" }
        ]
      };
    if ((nextBrief.goals?.length ?? 0) === 0)
      return {
        type: "clarification",
        message: "アンケートで確認したい内容は何ですか？",
        brief: nextBrief,
        missing: ["goals"]
      };
    return {
      type: "ready",
      message: "目的・対象者・確認内容を整理しました。ドラフトを作成できます。",
      brief: nextBrief
    };
  }
};
