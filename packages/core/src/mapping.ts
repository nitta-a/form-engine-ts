import { contentMetadataToJson } from "./contentMode";
import { assertValidFormSchema, type ValidateFormSchemaOptions } from "./schema";
import type { FieldOption, FormField, FormPage, FormSchema } from "./types";

/** Updates only explicitly supplied properties, retaining unknown JSON properties. */
export function mapSchemaNode<T extends object>(node: T, update: (node: Readonly<T>) => Partial<T>): T {
  contentMetadataToJson(node);
  const copy = structuredClone(node);
  const result = { ...copy, ...update(copy) };
  contentMetadataToJson(result);
  return result;
}

export function mapField<T extends FormField>(field: T, update: (field: Readonly<T>) => Partial<T & FormField>): T {
  return mapSchemaNode(field, update);
}

export function mapOption<T extends FieldOption>(
  option: T,
  update: (option: Readonly<T>) => Partial<T & FieldOption>
): T {
  return mapSchemaNode(option, update);
}

export function mapPage<T extends FormPage>(page: T, update: (page: Readonly<T>) => Partial<T & FormPage>): T {
  return mapSchemaNode(page, update);
}

export function mapSchema<T extends FormSchema>(
  schema: T,
  update: (schema: Readonly<T>) => Partial<T>,
  options: ValidateFormSchemaOptions = {}
): T {
  const result = mapSchemaNode(schema, update);
  assertValidFormSchema(result, options);
  return result;
}

export interface SchemaDomainCodec<TDomain, TSchema extends FormSchema = FormSchema> {
  readonly toFormSchema: (domain: TDomain) => TSchema;
  readonly fromFormSchema: (schema: TSchema, original: TDomain) => TDomain;
}

/** Validates mapped schemas at both boundaries; domain-specific merging belongs to the codec. */
export function createSchemaDomainCodec<TDomain, TSchema extends FormSchema = FormSchema>(
  codec: SchemaDomainCodec<TDomain, TSchema>,
  options: ValidateFormSchemaOptions = {}
): SchemaDomainCodec<TDomain, TSchema> {
  return {
    toFormSchema(domain) {
      const schema = codec.toFormSchema(domain);
      contentMetadataToJson(schema);
      assertValidFormSchema(schema, options);
      return structuredClone(schema);
    },
    fromFormSchema(schema, original) {
      contentMetadataToJson(schema);
      assertValidFormSchema(schema, options);
      return codec.fromFormSchema(structuredClone(schema), original);
    }
  };
}
