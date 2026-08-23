import type { TranslationAdapter } from "@form-engine/core";

export type TranslationCatalog = Readonly<Record<string, string>>;
export type TranslationCatalogs = Readonly<Record<string, TranslationCatalog>>;

export const mockCatalogs: TranslationCatalogs = {
  en: {
    "form.title": "Customer feedback",
    "form.description": "Tell us about your experience. Required fields are marked.",
    "form.submit": "Send response",
    "field.name.label": "Your name",
    "field.name.help": "Enter at least {{min}} characters.",
    "field.name.placeholder": "Ada Lovelace",
    "field.reference.label": "Reference code",
    "field.reference.help": "Use three uppercase letters followed by three digits.",
    "field.reference.placeholder": "ABC123",
    "field.comments.label": "What could we improve?",
    "field.comments.placeholder": "Share the details that matter most…",
    "field.age.label": "Your age",
    "field.age.placeholder": "18–100",
    "field.team.label": "Team",
    "field.team.help": "Choose the team you worked with.",
    "field.channels.label": "How did you contact us?",
    "field.channels.help": "Choose one or two channels.",
    "field.consent.label": "I agree that this response may be analyzed.",
    "field.recommend.label": "Would you recommend us?",
    "option.team.product": "Product",
    "option.team.support": "Support",
    "option.team.sales": "Sales",
    "option.channel.email": "Email",
    "option.channel.chat": "Chat",
    "option.channel.phone": "Phone",
    "option.yes": "Yes",
    "option.no": "No",
    "validation.required": "This field is required.",
    "validation.invalidType": "Enter a value in the expected format.",
    "validation.minLength": "Enter at least {{min}} characters.",
    "validation.maxLength": "Enter no more than {{max}} characters.",
    "validation.pattern": "Use the requested format.",
    "validation.min": "Enter a value of at least {{min}}.",
    "validation.max": "Enter a value no greater than {{max}}.",
    "validation.step": "Use increments of {{step}}.",
    "validation.invalidOption": "Choose one of the available options.",
    "validation.minSelections": "Choose at least {{min}} options.",
    "validation.maxSelections": "Choose no more than {{max}} options.",
    "validation.unknownField": "This response contains an unknown field.",
    "preview.language": "Language",
    "preview.success": "Response saved. Thank you!",
    "preview.error": "The response could not be saved. Try again.",
    "preview.analytics": "Response analytics",
    "preview.responses": "Responses",
    "preview.noResponses": "Submit the form to see aggregate results.",
    "preview.answered": "Answered",
    "preview.unanswered": "Unanswered",
    "preview.minimum": "Minimum",
    "preview.maximum": "Maximum",
    "preview.average": "Average",
    "preview.true": "Checked",
    "preview.false": "Not checked"
  },
  ja: {
    "form.title": "お客様アンケート",
    "form.description": "ご利用体験についてお聞かせください。必須項目には印があります。",
    "form.submit": "回答を送信",
    "field.name.label": "お名前",
    "field.name.help": "{{min}}文字以上で入力してください。",
    "field.name.placeholder": "山田 太郎",
    "field.reference.label": "参照コード",
    "field.reference.help": "英大文字3文字と数字3桁で入力してください。",
    "field.reference.placeholder": "ABC123",
    "field.comments.label": "改善してほしい点",
    "field.comments.placeholder": "特に重要な点をご記入ください…",
    "field.age.label": "年齢",
    "field.age.placeholder": "18〜100",
    "field.team.label": "担当チーム",
    "field.team.help": "ご利用になったチームを選択してください。",
    "field.channels.label": "お問い合わせ方法",
    "field.channels.help": "1つまたは2つ選択してください。",
    "field.consent.label": "この回答を分析に利用することに同意します。",
    "field.recommend.label": "他の方におすすめしますか？",
    "option.team.product": "製品",
    "option.team.support": "サポート",
    "option.team.sales": "営業",
    "option.channel.email": "メール",
    "option.channel.chat": "チャット",
    "option.channel.phone": "電話",
    "option.yes": "はい",
    "option.no": "いいえ",
    "validation.required": "この項目は必須です。",
    "validation.invalidType": "正しい形式で入力してください。",
    "validation.minLength": "{{min}}文字以上で入力してください。",
    "validation.maxLength": "{{max}}文字以内で入力してください。",
    "validation.pattern": "指定された形式で入力してください。",
    "validation.min": "{{min}}以上の値を入力してください。",
    "validation.max": "{{max}}以下の値を入力してください。",
    "validation.step": "{{step}}刻みで入力してください。",
    "validation.invalidOption": "選択肢から選んでください。",
    "validation.minSelections": "{{min}}つ以上選択してください。",
    "validation.maxSelections": "{{max}}つ以内で選択してください。",
    "validation.unknownField": "不明な項目が回答に含まれています。",
    "preview.language": "言語",
    "preview.success": "回答を保存しました。ありがとうございます。",
    "preview.error": "回答を保存できませんでした。もう一度お試しください。",
    "preview.analytics": "回答分析",
    "preview.responses": "回答数",
    "preview.noResponses": "フォームを送信すると集計結果が表示されます。",
    "preview.answered": "回答済み",
    "preview.unanswered": "未回答",
    "preview.minimum": "最小",
    "preview.maximum": "最大",
    "preview.average": "平均",
    "preview.true": "チェック済み",
    "preview.false": "未チェック"
  }
};

export class MockTranslationAdapter implements TranslationAdapter {
  constructor(
    readonly catalogs: TranslationCatalogs = mockCatalogs,
    readonly fallbackLocale = "en"
  ) {}

  translate(key: string, locale: string, params: Readonly<Record<string, string | number>> = {}): string {
    const template = this.catalogs[locale]?.[key] ?? this.catalogs[this.fallbackLocale]?.[key] ?? key;
    return template.replace(/\{\{(\w+)\}\}/g, (token, name: string) =>
      Object.hasOwn(params, name) ? String(params[name]) : token
    );
  }
}

export const mockTranslator = new MockTranslationAdapter();
