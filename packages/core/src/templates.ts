import type { FormContentMode } from "./contentMode";
import { contentMetadataToJson } from "./contentMode";
import type { FormSchema } from "./types";

interface LocalizedTemplateText {
  readonly en: string;
  readonly ja: string;
}

interface TemplateDefinition {
  readonly id: string;
  readonly mode: FormContentMode;
  readonly name: LocalizedTemplateText;
  readonly description: LocalizedTemplateText;
  readonly schema: (locale: string) => FormSchema;
}

export interface FormTemplate {
  readonly id: string;
  readonly mode: FormContentMode;
  readonly name: string;
  readonly description: string;
  readonly schema: FormSchema;
}

export interface GetFormTemplatesOptions {
  readonly mode?: FormContentMode;
  readonly locale?: string;
}

export interface CreateSchemaFromTemplateOptions {
  readonly template: FormTemplate;
  readonly id: string;
  readonly title: string;
}

function isJapanese(locale: string): boolean {
  return locale.toLowerCase().startsWith("ja");
}

function text(locale: string, value: LocalizedTemplateText): string {
  return isJapanese(locale) ? value.ja : value.en;
}

function schemaText(locale: string, en: string, ja: string): string {
  return isJapanese(locale) ? ja : en;
}

function templateSchema(locale: string, schema: Omit<FormSchema, "defaultLocale" | "supportedLocales">): FormSchema {
  return {
    ...schema,
    defaultLocale: locale,
    supportedLocales: [locale]
  };
}

const TEMPLATE_DEFINITIONS: readonly TemplateDefinition[] = [
  {
    id: "satisfaction-survey",
    mode: "survey",
    name: { en: "Satisfaction survey", ja: "満足度調査" },
    description: {
      en: "Collect ratings and improvement ideas without asking for contact details.",
      ja: "連絡先を尋ねずに、評価と改善案を集めます。"
    },
    schema: (locale) =>
      templateSchema(locale, {
        id: "template-satisfaction-survey",
        version: 1,
        title: schemaText(locale, "Satisfaction survey", "満足度調査"),
        description: schemaText(
          locale,
          "Please do not include personal information in open text answers.",
          "自由記述には個人情報を入力しないでください。"
        ),
        completionMessage: schemaText(locale, "Thank you for your feedback.", "ご回答ありがとうございました。"),
        fields: [
          {
            id: "overall-satisfaction",
            type: "rating",
            title: schemaText(locale, "Overall satisfaction", "総合満足度"),
            required: true,
            min: 1,
            max: 5
          },
          {
            id: "satisfaction-positive",
            type: "textarea",
            title: schemaText(locale, "What worked well?", "良かった点を教えてください"),
            required: false
          },
          {
            id: "satisfaction-improvement",
            type: "textarea",
            title: schemaText(locale, "What should we improve?", "改善してほしい点を教えてください"),
            required: false
          }
        ]
      })
  },
  {
    id: "improvement-suggestions",
    mode: "survey",
    name: { en: "Ideas and improvements", ja: "意見改善提案" },
    description: {
      en: "Find problems and suggestions while keeping feedback open and low-friction.",
      ja: "回答の負担を抑えながら、困りごとと改善案を集めます。"
    },
    schema: (locale) =>
      templateSchema(locale, {
        id: "template-improvement-suggestions",
        version: 1,
        title: schemaText(locale, "Ideas and improvements", "意見改善提案"),
        description: schemaText(
          locale,
          "Please do not include personal information in open text answers.",
          "自由記述には個人情報を入力しないでください。"
        ),
        completionMessage: schemaText(locale, "Thank you for your suggestion.", "ご提案ありがとうございました。"),
        fields: [
          {
            id: "improvement-category",
            type: "radio",
            title: schemaText(locale, "Which area does this concern?", "どの分野についての意見ですか？"),
            required: true,
            options: [
              { id: "experience", label: schemaText(locale, "Experience", "体験") },
              { id: "content", label: schemaText(locale, "Content", "内容") },
              { id: "process", label: schemaText(locale, "Process", "手順") }
            ]
          },
          {
            id: "improvement-problem",
            type: "textarea",
            title: schemaText(locale, "What is difficult or inconvenient?", "困っていること、不便なことは何ですか？"),
            required: false
          },
          {
            id: "improvement-idea",
            type: "textarea",
            title: schemaText(locale, "What would you improve?", "どのように改善したいですか？"),
            required: false
          }
        ]
      })
  },
  {
    id: "popular-choice-poll",
    mode: "poll",
    name: { en: "Popular choice poll", ja: "人気投票" },
    description: {
      en: "Ask one multiple-choice question with three editable example choices.",
      ja: "編集可能な3つの例から、1つを選ぶ投票を作成します。"
    },
    schema: (locale) =>
      templateSchema(locale, {
        id: "template-popular-choice-poll",
        version: 1,
        title: schemaText(locale, "Popular choice poll", "人気投票"),
        description: schemaText(
          locale,
          "These choices are examples. Replace them before publishing.",
          "候補は例です。公開前に編集してください。"
        ),
        completionMessage: schemaText(locale, "Thank you for voting.", "投票ありがとうございました。"),
        metadata: contentMetadataToJson({ mode: "poll", poll: { resultVisibility: "after_submit" } }),
        fields: [
          {
            id: "popular-choice",
            type: "radio",
            title: schemaText(locale, "Which option is most popular?", "どの候補が一番人気ですか？"),
            required: true,
            options: [
              { id: "choice-a", label: schemaText(locale, "Option A", "候補A") },
              { id: "choice-b", label: schemaText(locale, "Option B", "候補B") },
              { id: "choice-c", label: schemaText(locale, "Option C", "候補C") }
            ]
          }
        ]
      })
  },
  {
    id: "understanding-check",
    mode: "quiz",
    name: { en: "Understanding check", ja: "理解度チェック" },
    description: {
      en: "Start with three editable sample questions, correct answers, and explanations.",
      ja: "正解と解説付きの編集可能な例題3問から始めます。"
    },
    schema: (locale) =>
      templateSchema(locale, {
        id: "template-understanding-check",
        version: 1,
        title: schemaText(locale, "Understanding check", "理解度チェック"),
        description: schemaText(
          locale,
          "These questions are examples. Replace them before publishing.",
          "問題は例です。公開前に編集してください。"
        ),
        completionMessage: schemaText(
          locale,
          "Thank you for completing the quiz.",
          "クイズへの回答ありがとうございました。"
        ),
        metadata: contentMetadataToJson({ mode: "quiz", quiz: { showExplanation: "after_submit" } }),
        fields: [
          {
            id: "understanding-1",
            type: "radio",
            title: schemaText(locale, "Which answer is correct?", "正しい回答はどれですか？"),
            required: true,
            options: [
              { id: "understanding-1-a", label: schemaText(locale, "Answer A", "回答A") },
              { id: "understanding-1-b", label: schemaText(locale, "Answer B", "回答B") }
            ],
            metadata: contentMetadataToJson({
              quiz: {
                correctOptionId: "understanding-1-a",
                explanation: schemaText(
                  locale,
                  "Review the key idea and try again.",
                  "要点を確認して、もう一度考えてみましょう。"
                )
              }
            })
          },
          {
            id: "understanding-2",
            type: "radio",
            title: schemaText(locale, "Which step should come first?", "最初に行う手順はどれですか？"),
            required: true,
            options: [
              { id: "understanding-2-a", label: schemaText(locale, "Step A", "手順A") },
              { id: "understanding-2-b", label: schemaText(locale, "Step B", "手順B") }
            ],
            metadata: contentMetadataToJson({
              quiz: {
                correctOptionId: "understanding-2-b",
                explanation: schemaText(
                  locale,
                  "The first step establishes the context.",
                  "最初の手順で前提を確認します。"
                )
              }
            })
          },
          {
            id: "understanding-3",
            type: "radio",
            title: schemaText(locale, "What is the best next action?", "次に行う最適な対応はどれですか？"),
            required: true,
            options: [
              { id: "understanding-3-a", label: schemaText(locale, "Action A", "対応A") },
              { id: "understanding-3-b", label: schemaText(locale, "Action B", "対応B") }
            ],
            metadata: contentMetadataToJson({
              quiz: {
                correctOptionId: "understanding-3-a",
                explanation: schemaText(
                  locale,
                  "Use the evidence from the previous step.",
                  "前の手順で得た情報を使います。"
                )
              }
            })
          }
        ]
      })
  }
];

export function getFormTemplates(options: GetFormTemplatesOptions = {}): readonly FormTemplate[] {
  const locale = options.locale ?? "en";
  return TEMPLATE_DEFINITIONS.filter(
    (definition) => options.mode === undefined || definition.mode === options.mode
  ).map((definition) => ({
    id: definition.id,
    mode: definition.mode,
    name: text(locale, definition.name),
    description: text(locale, definition.description),
    schema: structuredClone(definition.schema(locale))
  }));
}

export function createSchemaFromTemplate(options: CreateSchemaFromTemplateOptions): FormSchema {
  const schema = structuredClone(options.template.schema);
  return {
    ...schema,
    id: options.id,
    title: options.title,
    version: 1
  };
}
