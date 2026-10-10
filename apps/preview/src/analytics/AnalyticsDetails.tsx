import type { FormSchema, QuestionAggregate } from "@form-engine-ts/core";
import { mockTranslator } from "@form-engine-ts/translator-mock";

function formatNumber(value: number | null): string {
  return value === null ? "—" : Number.isInteger(value) ? String(value) : value.toFixed(1);
}

interface OptionBarProps {
  readonly label: string;
  readonly count: number;
  readonly percentage: number;
}

function OptionBar({ label, count, percentage }: OptionBarProps) {
  return (
    <div className="option-bar">
      <div>
        <span>{label}</span>
        <strong>
          {count} · {percentage.toFixed(0)}%
        </strong>
      </div>
      <div className="track" aria-hidden="true">
        <span style={{ width: `${Math.min(percentage, 100)}%` }} />
      </div>
    </div>
  );
}

interface AnalyticsDetailsProps {
  readonly aggregate: QuestionAggregate;
  readonly schema: FormSchema;
  readonly locale: string;
}

export function AnalyticsDetails({ aggregate, schema, locale }: AnalyticsDetailsProps) {
  const t = (key: string) => mockTranslator.translate(key, locale) ?? key;
  if (aggregate.kind === "number" || aggregate.kind === "rating") {
    return (
      <dl className="metric-grid">
        <div>
          <dt>{t("preview.minimum")}</dt>
          <dd>{formatNumber(aggregate.minimum)}</dd>
        </div>
        <div>
          <dt>{t("preview.maximum")}</dt>
          <dd>{formatNumber(aggregate.maximum)}</dd>
        </div>
        <div>
          <dt>{t("preview.average")}</dt>
          <dd>{formatNumber(aggregate.average)}</dd>
        </div>
        <div>
          <dt>{t("preview.total")}</dt>
          <dd>{formatNumber(aggregate.total)}</dd>
        </div>
      </dl>
    );
  }
  if (aggregate.kind === "checkbox") {
    return (
      <div className="option-bars">
        <OptionBar
          label={t("preview.true")}
          count={aggregate.trueCount}
          percentage={aggregate.truePercentageOfSubmissions}
        />
        <OptionBar
          label={t("preview.false")}
          count={aggregate.falseCount}
          percentage={aggregate.falsePercentageOfSubmissions}
        />
      </div>
    );
  }
  if (aggregate.kind === "select" || aggregate.kind === "radio" || aggregate.kind === "multi-select") {
    const field = schema.fields.find((item) => item.id === aggregate.fieldId);
    return (
      <div className="option-bars">
        {aggregate.options.map((option) => {
          const schemaOption =
            field !== undefined && "options" in field ? field.options.find((item) => item.id === option.id) : undefined;
          return (
            <OptionBar
              key={option.id}
              label={schemaOption === undefined ? option.id : schemaOption.label}
              count={option.count}
              percentage={option.percentageOfSubmissions}
            />
          );
        })}
      </div>
    );
  }
  return null;
}
