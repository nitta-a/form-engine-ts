import type { FormSchema } from "@form-engine-ts/core";

export const customerFeedbackSchema = {
  id: "customer-feedback",
  version: 1,
  title: "サービスの満足度",
  description: "ご利用いただいたサービスについてお聞かせください。",
  completionMessage: "ご回答ありがとうございました。",
  defaultLocale: "ja",
  supportedLocales: ["ja", "en"],
  metadata: { owner: "ARGS", release: "v2.9.0" },
  translations: {
    en: {
      title: "Service satisfaction",
      description: "Tell us about the service you used.",
      completionMessage: "Thank you for your response."
    }
  },
  submitLabelKey: "form.submit",
  fields: [
    {
      id: "q_a1b2c3d4",
      type: "text",
      title: "お名前",
      description: "2文字以上で入力してください。",
      translationKey: "field.name.label",
      placeholderKey: "field.name.placeholder",
      required: true,
      metadata: { externalId: "args-customer-name" },
      translations: { en: { title: "Your name", description: "Enter at least two characters." } },
      minLength: 2,
      maxLength: 80
    },
    {
      id: "q_b2c3d4e5",
      type: "text",
      title: "参照コード",
      description: "英大文字3文字と数字3桁で入力してください。",
      translationKey: "field.reference.label",
      placeholderKey: "field.reference.placeholder",
      required: true,
      translations: {
        en: { title: "Reference code", description: "Enter three uppercase letters followed by three digits." }
      },
      pattern: "^[A-Z]{3}\\d{3}$"
    },
    {
      id: "q_c3d4e5f6",
      type: "textarea",
      title: "改善してほしい点",
      translationKey: "field.comments.label",
      required: false,
      translations: { en: { title: "What could we improve?" } },
      placeholderKey: "field.comments.placeholder",
      maxLength: 200
    },
    {
      id: "q_d4e5f6a7",
      type: "number",
      title: "年齢",
      translationKey: "field.age.label",
      placeholderKey: "field.age.placeholder",
      required: true,
      translations: { en: { title: "Age" } },
      min: 18,
      max: 100,
      step: 1
    },
    {
      id: "q_e5f6a7b8",
      type: "select",
      title: "担当チーム",
      description: "ご利用になったチームを選択してください。",
      translationKey: "field.team.label",
      required: true,
      translations: { en: { title: "Team", description: "Choose the team you worked with." } },
      options: [
        {
          id: "opt_a1b2c3d4",
          label: "製品",
          translations: { en: "Product" },
          metadata: { analyticsCode: "product" }
        },
        { id: "opt_b2c3d4e5", label: "サポート", translations: { en: "Support" } },
        { id: "opt_c3d4e5f6", label: "営業", translations: { en: "Sales" } }
      ]
    },
    {
      id: "q_f6a7b8c9",
      type: "multi-select",
      title: "お問い合わせ方法",
      description: "1つまたは2つ選択してください。",
      translationKey: "field.channels.label",
      required: true,
      translations: { en: { title: "How did you contact us?", description: "Choose one or two channels." } },
      minSelections: 1,
      maxSelections: 2,
      options: [
        { id: "opt_d4e5f6a7", label: "メール", translations: { en: "Email" } },
        { id: "opt_e5f6a7b8", label: "チャット", translations: { en: "Chat" } },
        { id: "opt_f6a7b8c9", label: "電話", translations: { en: "Phone" } }
      ]
    },
    {
      id: "q_a7b8c9d0",
      type: "checkbox",
      title: "この回答を分析に利用することに同意します。",
      translationKey: "field.consent.label",
      required: true,
      translations: { en: { title: "I agree that this response may be analyzed." } }
    },
    {
      id: "q_b8c9d0e1",
      type: "radio",
      title: "他の方におすすめしますか？",
      translationKey: "field.recommend.label",
      required: true,
      translations: { en: { title: "Would you recommend us?" } },
      options: [
        { id: "opt_a7b8c9d0", label: "はい", translations: { en: "Yes" } },
        { id: "opt_b8c9d0e1", label: "いいえ", translations: { en: "No" } }
      ]
    },
    {
      id: "q_c9d0e1f2",
      type: "rating",
      title: "今回の体験を評価してください",
      translationKey: "field.rating.label",
      required: true,
      translations: { en: { title: "How would you rate your experience?" } },
      min: 1,
      max: 5
    },
    {
      id: "q_d0e1f2a3",
      type: "textarea",
      title: "残念だった理由を教えてください",
      translationKey: "field.followup.label",
      required: false,
      translations: { en: { title: "What made the experience disappointing?" } },
      maxLength: 200,
      displayCondition: { questionId: "q_b8c9d0e1", operator: "equals", value: "opt_b8c9d0e1" }
    }
  ],
  pages: [
    {
      id: "page_basic",
      title: "基本情報",
      description: "回答者とご利用内容について教えてください。",
      translations: { en: { title: "Basic information", description: "Tell us about yourself and your visit." } },
      metadata: { section: "identity" },
      questionIds: ["q_a1b2c3d4", "q_b2c3d4e5", "q_d4e5f6a7"]
    },
    {
      id: "page_details",
      title: "詳細アンケート",
      translations: { en: { title: "Detailed survey" } },
      questionIds: ["q_e5f6a7b8", "q_f6a7b8c9", "q_b8c9d0e1", "q_c9d0e1f2", "q_d0e1f2a3"]
    },
    {
      id: "page_review",
      title: "ご意見・確認",
      translations: { en: { title: "Comments and confirmation" } },
      questionIds: ["q_c3d4e5f6", "q_a7b8c9d0"]
    }
  ]
} as const satisfies FormSchema;
