import type { FormSchema } from "@form-engine/core";

export const customerFeedbackSchema = {
  id: "customer-feedback",
  version: 1,
  titleKey: "form.title",
  descriptionKey: "form.description",
  submitLabelKey: "form.submit",
  fields: [
    {
      id: "name",
      type: "text",
      labelKey: "field.name.label",
      helpTextKey: "field.name.help",
      placeholderKey: "field.name.placeholder",
      required: true,
      minLength: 2,
      maxLength: 80
    },
    {
      id: "reference",
      type: "text",
      labelKey: "field.reference.label",
      helpTextKey: "field.reference.help",
      placeholderKey: "field.reference.placeholder",
      required: true,
      pattern: "^[A-Z]{3}\\d{3}$"
    },
    {
      id: "comments",
      type: "textarea",
      labelKey: "field.comments.label",
      placeholderKey: "field.comments.placeholder",
      maxLength: 200
    },
    {
      id: "age",
      type: "number",
      labelKey: "field.age.label",
      placeholderKey: "field.age.placeholder",
      required: true,
      min: 18,
      max: 100,
      step: 1
    },
    {
      id: "team",
      type: "select",
      labelKey: "field.team.label",
      helpTextKey: "field.team.help",
      required: true,
      options: [
        { value: "product", labelKey: "option.team.product" },
        { value: "support", labelKey: "option.team.support" },
        { value: "sales", labelKey: "option.team.sales" }
      ]
    },
    {
      id: "channels",
      type: "multi-select",
      labelKey: "field.channels.label",
      helpTextKey: "field.channels.help",
      required: true,
      minSelections: 1,
      maxSelections: 2,
      options: [
        { value: "email", labelKey: "option.channel.email" },
        { value: "chat", labelKey: "option.channel.chat" },
        { value: "phone", labelKey: "option.channel.phone" }
      ]
    },
    {
      id: "consent",
      type: "checkbox",
      labelKey: "field.consent.label",
      required: true
    },
    {
      id: "recommend",
      type: "radio",
      labelKey: "field.recommend.label",
      required: true,
      options: [
        { value: "yes", labelKey: "option.yes" },
        { value: "no", labelKey: "option.no" }
      ]
    }
  ]
} as const satisfies FormSchema;
