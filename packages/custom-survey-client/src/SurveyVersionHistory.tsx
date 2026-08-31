import type { ReactNode } from "react";

export interface SurveyVersionHistoryProps<TVersion> {
  readonly versions: readonly TVersion[];
  readonly getVersionKey?: (version: TVersion, index: number) => string | number;
  readonly getVersionLabel?: (version: TVersion, index: number) => ReactNode;
  readonly render?: (versions: readonly TVersion[]) => ReactNode;
  readonly slots?: SurveyVersionHistorySlots<TVersion>;
  readonly title?: string;
}

export interface SurveyVersionHistorySlots<TVersion> {
  readonly item?: (props: { readonly version: TVersion; readonly index: number }) => ReactNode;
  readonly empty?: () => ReactNode;
}

/** Renders version history without imposing a persistence model or UI library. */
export function SurveyVersionHistory<TVersion>({
  versions,
  getVersionKey,
  getVersionLabel,
  render,
  slots,
  title = "Version history"
}: SurveyVersionHistoryProps<TVersion>): React.JSX.Element {
  if (render !== undefined) return <>{render(versions)}</>;
  if (versions.length === 0) return <>{slots?.empty?.() ?? <p>No versions.</p>}</>;
  return (
    <section className="fe-survey-version-history">
      <h2>{title}</h2>
      <ol>
        {versions.map((version, index) => (
          <li key={getVersionKey?.(version, index) ?? `version-${index}`}>
            {slots?.item?.({ version, index }) ?? getVersionLabel?.(version, index) ?? `Version ${index + 1}`}
          </li>
        ))}
      </ol>
    </section>
  );
}
