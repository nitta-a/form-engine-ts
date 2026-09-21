import type { CreationAssistantAdapter, SurveyCreationBrief } from "@form-engine-ts/core";

export const mockCreationAssistantAdapter: CreationAssistantAdapter = {
  async respond({ latestMessage, brief, locale }, signal) {
    if (signal?.aborted) throw new DOMException("The request was cancelled.", "AbortError");
    const japanese = (locale ?? brief.locale ?? "").startsWith("ja");
    const nextBrief: SurveyCreationBrief =
      brief.purpose === undefined
        ? { ...brief, purpose: latestMessage, ...(locale === undefined ? {} : { locale }) }
        : brief.audience === undefined
          ? { ...brief, audience: latestMessage, ...(locale === undefined ? {} : { locale }) }
          : { ...brief, goals: [...(brief.goals ?? []), latestMessage], ...(locale === undefined ? {} : { locale }) };
    if (nextBrief.audience === undefined)
      return {
        type: "clarification",
        message: japanese ? "誰から回答を集めたいですか？" : "Who should answer this survey?",
        brief: nextBrief,
        missing: ["audience"],
        suggestions: [
          japanese
            ? { id: "employees", label: "社員", value: "社員" }
            : { id: "employees", label: "Employees", value: "Employees" },
          japanese
            ? { id: "customers", label: "顧客", value: "顧客" }
            : { id: "customers", label: "Customers", value: "Customers" }
        ]
      };
    if ((nextBrief.goals?.length ?? 0) === 0)
      return {
        type: "clarification",
        message: japanese ? "アンケートで確認したい内容は何ですか？" : "What would you like to learn from this survey?",
        brief: nextBrief,
        missing: ["goals"]
      };
    return {
      type: "ready",
      message: japanese
        ? "目的・対象者・確認内容を整理しました。ドラフトを作成できます。"
        : "I organized the purpose, audience, and goals. You can create a draft.",
      brief: nextBrief
    };
  }
};
