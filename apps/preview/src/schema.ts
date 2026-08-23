import type { FormSchema } from "@form-engine/core";

export const customerFeedbackSchema = {
  id: "customer-feedback",
  version: 1,
  title: "サービスの満足度",
  description: "ご利用いただいたサービスについてお聞かせください。",
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
      pattern: "^[A-Z]{3}\\d{3}$"
    },
    {
      id: "q_c3d4e5f6",
      type: "textarea",
      title: "改善してほしい点",
      translationKey: "field.comments.label",
      required: false,
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
      options: [
        { id: "opt_a1b2c3d4", label: "製品" },
        { id: "opt_b2c3d4e5", label: "サポート" },
        { id: "opt_c3d4e5f6", label: "営業" }
      ]
    },
    {
      id: "q_f6a7b8c9",
      type: "multi-select",
      title: "お問い合わせ方法",
      description: "1つまたは2つ選択してください。",
      translationKey: "field.channels.label",
      required: true,
      minSelections: 1,
      maxSelections: 2,
      options: [
        { id: "opt_d4e5f6a7", label: "メール" },
        { id: "opt_e5f6a7b8", label: "チャット" },
        { id: "opt_f6a7b8c9", label: "電話" }
      ]
    },
    {
      id: "q_a7b8c9d0",
      type: "checkbox",
      title: "この回答を分析に利用することに同意します。",
      translationKey: "field.consent.label",
      required: true
    },
    {
      id: "q_b8c9d0e1",
      type: "radio",
      title: "他の方におすすめしますか？",
      translationKey: "field.recommend.label",
      required: true,
      options: [
        { id: "opt_a7b8c9d0", label: "はい" },
        { id: "opt_b8c9d0e1", label: "いいえ" }
      ]
    },
    {
      id: "q_c9d0e1f2",
      type: "rating",
      title: "今回の体験を評価してください",
      translationKey: "field.rating.label",
      required: true,
      min: 1,
      max: 5
    },
    {
      id: "q_d0e1f2a3",
      type: "textarea",
      title: "残念だった理由を教えてください",
      translationKey: "field.followup.label",
      required: false,
      maxLength: 200,
      displayCondition: { questionId: "q_b8c9d0e1", operator: "equals", value: "opt_b8c9d0e1" }
    }
  ]
} as const satisfies FormSchema;
