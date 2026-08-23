# Repository Guide for Coding Agents

## Scope

This file applies to the entire repository. Keep changes focused on the requested task and preserve unrelated work in the working tree.

## Repository Overview

This is a pnpm/Turborepo monorepo for a schema-driven form engine written in strict TypeScript.

- `packages/core`: framework-independent schemas, validation, visibility, submissions, translation contracts, sanitization, analytics, and CSV helpers.
- `packages/react`: React provider, renderer, builder, hooks, and base styles. It depends on `@form-engine/core` and must remain SSR-safe and accessible.
- `packages/storage-*`: storage adapters implementing the contracts exported by Core.
- `packages/translator-*`: translation adapters implementing the contracts exported by Core.
- `packages/zod`: Zod integration for Core schemas and validation issues.
- `apps/preview`: private Vite application used to exercise the packages together.

Package source lives in `src/`, tests live in `test/` (except the preview app's colocated test), and public package entry points are `src/index.ts`.

## Toolchain and Commands

- Use Node.js `>=22.22.2` and pnpm `11` as declared in the root `package.json`.
- Install dependencies with `pnpm install --frozen-lockfile` when the lockfile is expected to be current.
- Start the preview with `pnpm dev`.
- Run a package test directly with `pnpm --filter @form-engine/core test`, replacing the package name as needed.
- Run repository checks with:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

During development, prefer the narrowest relevant package command. Before handoff, run all four repository checks when practical; at minimum, run the tests and type checks covering the changed packages. Report any check that could not be run.

Do not commit generated `dist/`, Turbo cache output, or Vite cache output. Update `pnpm-lock.yaml` only when dependency metadata changes.

## Code Conventions

- Keep the project ESM-only and compatible with the TypeScript settings in `tsconfig.base.json`.
- Preserve strict typing. Avoid `any`, non-null assertions, and type casts that bypass validation when a type guard or explicit check can express the invariant.
- Use `import type` for type-only imports.
- Let Biome enforce formatting and import organization: two-space indentation, double quotes, semicolons, no trailing commas, and a 120-column line width.
- Keep Core framework-independent. Browser, React, database, and vendor-specific behavior belongs in the corresponding adapter or UI package.
- Import workspace packages through their public `@form-engine/*` entry point. Export new public APIs from that package's `src/index.ts`; avoid cross-package deep imports.
- Use `workspace:*` for internal package dependencies and keep runtime, peer, and development dependencies in the appropriate manifest section.
- Treat schema fields, serialized submissions, adapter contracts, and package exports as public API. Avoid accidental breaking changes; update all consumers and documentation when a deliberate change is required.
- Keep environment-dependent services injectable. Tests must not call live translation services, browsers, or databases.

## Testing Expectations

- Use Vitest and follow the existing `describe`/`it` style.
- Add or update tests for every behavior change, including failure paths and boundary cases.
- Prefer observable behavior over implementation details. Keep fixtures deterministic and avoid reliance on wall-clock time, network access, or test order.
- Core changes may affect every adapter, the React package, Zod integration, and the preview app; validate those dependents when changing shared types or contracts.
- React tests should query by accessible role or label where possible and should cover keyboard/focus, validation, and SSR-sensitive behavior when relevant.
- Adapter tests should verify contract behavior such as defensive copying, duplicate handling, filtering, and error propagation where applicable.

## Documentation and Releases

- Update the relevant package `README.md` for changes to a published package's installation, API, or examples.
- The root `README.md` has English and Japanese sections. Keep both sections aligned when changing repository-level behavior or documented APIs.
- Keep package manifests, exports, included files, and README examples synchronized with public API changes.
- Do not change package versions or publishing workflow files unless the task explicitly concerns a release.
