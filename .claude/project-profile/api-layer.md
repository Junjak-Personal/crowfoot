# API Layer

> **There is no HTTP API client on the fork's work surface.** No axios/ky, no auth, no interceptors,
> no OpenAPI/GraphQL/tRPC codegen. The viewer is a static SPA that reads one JSON file.
> This document records the **file-based data contract** that plays the same role — it is what
> Architect-BE and Designers need instead.
>
> (Upstream `frontend/apps/app` does have Supabase + Server Actions. The fork does not touch it;
> if a task ever reaches into `frontend/apps/app`, re-scan first — nothing here applies there.)

## Client
- Type: framework-free — a single `fetch('./schema.json')` from the viewer at runtime
- Base client: native `fetch`
- Base URL config: **none** — all artifact paths are relative, which is what lets the build mount
  under any subpath (`/erd/`) without a rebuild

## The data contract (`@liam-hq/schema`)

```
source (DDL / schema.rb / prisma / drizzle / tbls JSON)
  ──parser──▶  Schema  (valibot-validated in-memory model)
                 ├──▶  dist/schema.json      → fetched by the viewer at runtime
                 └──deparser──▶ PostgreSQL DDL · MySQL DDL (fork) · YAML
```

- Model + validation: `frontend/packages/schema/src/schema/` — `schemaSchema`, `Schema`, `Table`,
  `Column`, `Constraint`, `Index`, plus `aSchema`/`aTable`/`aColumn` builders used as test factories
- Package entry points: `@liam-hq/schema` (`.`) and `@liam-hq/schema/parser` (`./parser`)
- Validation library: **Valibot 1.1.0** (`zod` 4.0.0 is present only for the tbls JSON-Schema→zod
  codegen path, see below)
- Errors: `neverthrow` `Result` — parsers return `ProcessError[]` rather than throwing

### Parsers (input side) — `src/parser/`
`sql/` (PostgreSQL via `pg-query-emscripten`) · `schemarb/` (Ruby via `@ruby/prism` wasm) ·
`prisma/` (`@prisma/internals`) · `drizzle/` (`@swc/core`) · `tbls/` · `liam/`
Format enum: `src/parser/supportedFormat/` → `SupportedFormat`.

### Deparsers (output side) — `src/deparser/`
| Target | Path | Owner |
|---|---|---|
| PostgreSQL | `deparser/postgresql/` | upstream |
| YAML | `deparser/yaml/` | upstream |
| **MySQL** | `deparser/mysql/` | **fork** — `mysqlSchemaDeparser`, exported from `src/index.ts` |

All deparsers implement the shared `SchemaDeparser` / `OperationDeparser` types in `deparser/type.ts`.
**Add a new target by implementing that interface**, not by special-casing at the call site.

## Generated Code
- Generator: `json-schema-to-zod` — the **only** codegen in the repo
- Output: `frontend/packages/schema/src/parser/tbls/schema.generated.ts` (declared as a turbo output)
- Regen command: `pnpm --filter @liam-hq/schema gen` (turbo task `@liam-hq/schema#gen`)
- Spec source: the tbls JSON Schema (committed; no running backend required)
- Hand-maintained overrides inside the generated tree: **None**
- Post-regen fixups: **None**
- Editable: **no** — `schema.generated.ts` is regenerated; edit the source schema instead

## CLI ingest contract (`@liam-hq/cli`)
```
<cli> erd build --format <fmt> --input <path-or-url> --output-dir <dir>
```
- `runPreprocess` parses the input → writes `<outDir>/schema.json`
- `buildCommand` then `cpSync`s the prebuilt viewer from `dist-cli/html` over `<outDir>`
- ⚠️ **`--input` with an absolute path is interpreted as a URL and dies with `fetch failed`.
  Use relative paths only.**
- ⚠️ `dist/schema.json` (viewer data source, **must be deployed**) and the outer input `schema.json`
  (tbls extract, **not deployed**) are different files with the same name. Do not conflate them.
- Known gap: `layout.json` / `memos.json` are currently `cp`'d into `dist/` by an external script.
  There is **no `--layout` / `--memos` CLI option yet** — injecting them belongs right after
  `cpSync(cliHtmlPath, resolvedOutDir)` in `src/cli/erdCommand/buildCommand/index.ts`.

## Auth
- N/A — static artifact, no tokens, no sessions. Access control is at the CDN/bucket layer.

## Error Handling
- `neverthrow` `Result` throughout the parse/deparse path; errors accumulate into `CliError[]` /
  `ProcessError[]` and are reported by `actionRunner.ts` rather than thrown
- CLI error types: `frontend/packages/cli/src/cli/errors.ts` (`FileSystemError`, …)
- Viewer surfaces failures via `ERDRenderer/ErrorDisplay/`
