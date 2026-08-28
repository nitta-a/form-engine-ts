# Repository Guide for Coding Agents

## Scope

This file applies to the entire repository. Keep changes focused on the requested task and preserve unrelated work in the working tree.

## Repository Overview

This is a pnpm/Turborepo monorepo for a schema-driven form engine written in strict TypeScript.

- `packages/core`: framework-independent schemas, validation, visibility, submissions, translation contracts, sanitization, analytics, and CSV helpers.
- `packages/react`: React provider, renderer, builder, hooks, and base styles. It depends on `@form-engine-ts/core` and must remain SSR-safe and accessible.
- `packages/storage-*`: storage adapters implementing the contracts exported by Core.
- `packages/translator-*`: translation adapters implementing the contracts exported by Core.
- `packages/zod`: Zod integration for Core schemas and validation issues.
- `apps/preview`: private Vite application used to exercise the packages together.

Package source lives in `src/`, tests live in `test/` (except the preview app's colocated test), and public package entry points are `src/index.ts`.

## Toolchain and Commands

- Use Node.js `>=22.22.2` and pnpm `11` as declared in the root `package.json`.
- pnpm is the only supported package manager. Do not use npm or yarn, and do not replace `pnpm-lock.yaml` with another lockfile.
- Install dependencies with `pnpm install --frozen-lockfile` when the lockfile is expected to be current.
- Start the preview with `pnpm dev`.
- Run a package test directly with `pnpm --filter @form-engine-ts/core test`, replacing the package name as needed.
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
- End every source and configuration file with a newline.
- Let Biome enforce formatting and import organization: two-space indentation, double quotes, semicolons, no trailing commas, and a 120-column line width.
- Keep Core framework-independent. Browser, React, database, and vendor-specific behavior belongs in the corresponding adapter or UI package.
- Import workspace packages through their public `@form-engine-ts/*` entry point. Export new public APIs from that package's `src/index.ts`; avoid cross-package deep imports.
- Use `workspace:*` for internal package dependencies and keep runtime, peer, and development dependencies in the appropriate manifest section.
- The MongoDB adapter uses the official native `mongodb` driver. Do not introduce Mongoose into this repository.
- Treat schema fields, serialized submissions, adapter contracts, and package exports as public API. Avoid accidental breaking changes; update all consumers and documentation when a deliberate change is required.
- Keep environment-dependent services injectable. Tests must not call live translation services, browsers, or databases.

### Function and data-shaping style

- Group related functions together and leave a blank line between logical groups.
- Keep a one-line expression on one line when it fits the configured line width. In particular, keep short object literals on one line.
- When building an object from another object's properties, destructure the needed values first and use shorthand properties where possible.
- For calls with several derived or semantically related arguments, calculate the values before the call and pass a named `params` object. Simple single-argument calls may remain inline when that is clearer.
- Prefer early returns and `if` statements for simple value-returning branches; do not introduce a ternary merely to reduce line count.
- Extract a complex callback passed to `map`, `filter`, `flatMap`, or similar methods into a named function. Short predicates and projections may remain inline.

### React and UI style

- For new custom hooks, keep one hook per file. A context module may colocate its provider with the closely related public context hook(s); do not split existing public context APIs solely to satisfy this preference.
- For new view modules, keep the number of components small (normally no more than two); split a module when adding a third independent view component. Existing public renderer and builder modules are intentionally larger and should not be refactored as unrelated cleanup.
- Define object-shaped component props with `interface` in the component module. Use a `type` when a union, tuple, or other type composition is the better model.
- For hooks and components with multiple inputs, receive a `props` object and destructure it near the start of the function. Destructuring simple props in the parameter list is acceptable when it improves readability.
- Use `useMemo` and `useCallback` only when they provide a clear benefit, such as expensive derivation, stable context values, or a required effect dependency; do not add them by default.
- Move complex stateful or behavioral logic into a custom hook. Prefer the existing UI components, MUI adapters, and package style abstractions before introducing a new abstraction.
- Keep inline styles to the minimum needed for dynamic values. Follow the package's existing CSS/style approach; this repository does not require Next.js, Tailwind CSS, shadcn/ui, or Radix UI.

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
