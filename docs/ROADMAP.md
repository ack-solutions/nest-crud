# nest-crud — Improvement Roadmap

This document tracks the work to take `@ackplus/nest-crud` and
`@ackplus/nest-crud-request` "to the next level": clean, fully tested,
well-documented, and safe to upgrade — **without breaking existing users**.

## Strategy

- **Hybrid versioning** — every non-breaking change ships on the **v1.x** line
  immediately. Behavior-changing improvements are batched into a single **v2.0**
  with a written migration guide and deprecation aliases, so existing apps
  upgrade with minimal changes.
- **Stabilize first** — make tests run + fix the broken example + add CI before
  touching anything else, so we always have a safety net.
- **Non-goals** — no rewrite of the query engine. The `@Crud` decorator → routes
  factory → `CrudService` architecture and the request-query wire format stay.

## Progress

- [x] **Phase 0 — Stabilize** ✅ (tests run, example works, CI added)
- [ ] **Phase 1 — Clean the junk**
- [ ] **Phase 2 — Tests so updates never break users** (+ non-breaking bug fixes)
- [ ] **Phase 3 — Swagger polish**
- [ ] **Phase 4 — Developer documentation**
- [ ] **Phase 5 — v2.0 breaking polish** (+ migration guide)

---

## Phase 0 — Stabilize (non-breaking, v1.x) ✅ DONE

Goal: a green, runnable test suite + a working example + CI.

- [x] Dropped Nx leftovers (`project.json`, `tsconfig.lib.json` references);
      standardized on **pnpm + tsc + jest**. Added root `jest.preset.js` and
      converted package jest configs to `.js`.
- [x] Wired `test` / `test:watch` / `test:cov` scripts in both packages + a root
      `pnpm -r test`.
- [x] Added the missing test devDeps (jest, ts-jest, @nestjs/testing, typeorm,
      class-validator/-transformer, reflect-metadata, rxjs, supertest, sql.js).
- [x] Switched the test + example database to TypeORM's **`sqljs`** driver
      (pure-WASM SQLite) — no native build, works on any Node version / CI.
- [x] Fixed `useDefineForClassFields: false` (TypeORM best practice) so entity
      hydration is clean — this also fixed 5 field-selection test assertions.
- [x] Existing unit specs green: **34** (request) + **65** (backend).
- [x] Fixed the example app: object route form (`{ enabled: true }`), removed the
      stacked `@Controller`, `authorId` → UUID string, in-memory by default.
- [x] Replaced the broken e2e (imported a non-existent `SeederService`) with real
      CRUD HTTP tests over the generated routes (**7 passing**); removed the
      phantom `seeder.config.js` / `nodemon.json`.
- [x] Bumped the example to `@nestjs/swagger`/`@nestjs/typeorm` v11 (matches the
      library peer range).
- [x] Added `.github/workflows/ci.yml` (install → build → test → e2e on every PR
      and push to `main`) and gated the publish workflow on green tests.

**Exit check met:** `pnpm install && pnpm build && pnpm -r test` + example e2e all
green (107 tests).

---

## Phase 1 — Clean the junk (non-breaking, v1.x)

- Reconcile the two barrels — make `packages/nest-crud/src/index.ts` the single
  public entry; delete the dead `src/lib/index.ts`. Additively export power-user
  escape hatches the override docs reference (`R`, `CrudRoutesFactory`).
- Delete dead code: `createMethodNameInterceptor` block + unused imports,
  `BaseEntityWithTrash`, `CRUD_METHOD_NAME_KEY`, commented `where` DTO blocks,
  unused `setCrudAuthOptions` / `CRUD_AUTH_OPTIONS_METADATA`, no-op
  self-assignments, duplicate hash `set`.
- Remove committed junk: 6 `.DS_Store` + `*.tsbuildinfo`; add to `.gitignore`.
- Add `LICENSE` (MIT) — every `package.json` lists it but it's missing.
- Fix org-name drift: repo URLs → `github.com/ack-solutions/nest-crud`.
- Consolidate publishing on the tag-based `publish.yml`; remove the parallel,
  build-before-bump `scripts/publish.js`.
- Delete the stale `examples/{vue,angular,react}` snippets and empty stub READMEs
  (replaced by correct guides in Phase 4).

## Phase 2 — Tests so updates never break users (non-breaking, v1.x)

Lands the **non-breaking bug fixes** (each with a regression test).

- Shared HTTP harness + route tests for all 15 CRUD actions; operator
  round-trip tests (client builder → query string → server parse → SQL → result).
- Coverage for soft-delete, bulk, pagination/`maxPerPage`, validation (400),
  guards/interceptors, lifecycle hooks.
- **Security**: PoC + fix for `where`/`order` field-key SQL-injection (column /
  relation allowlist); empty `$notIn` → `1=1`; `$between` 2-element validation.
- `crud-service` fixes: honor `beforeFindOne` return value; `counts()` use the real
  primary key (not hardcoded `"id"`) + null-deref guard; `canCreateRoute` honor
  boolean route config; `createMany` reload; `reorder` in a transaction; unify
  `maxPerPage`/`maxPageSize`.
- Swagger contract/snapshot test (operationIds, status codes, body schemas).
- Coverage thresholds in CI.

## Phase 3 — Swagger polish (non-breaking, v1.x)

- `@ApiBody` + dedicated create/update DTOs (stop leaking server-managed fields).
- Fix `operationId` collisions, createMany/updateMany array types, typed
  pagination items, `format: uuid` on id params, real `reorder` response schema.
- Verify clean output on `@nestjs/swagger` v10 and v11.

## Phase 4 — Developer documentation (non-breaking, v1.x)

- Docs site at `ack-solutions.github.io/nest-crud` (where Swagger already links).
- Author getting-started, configuration, routes, querying (all 26 operators),
  soft-delete, lifecycle-hooks, **auth-guards**, validation, overriding-routes,
  **error-handling**, **troubleshooting**, request-builder, and **corrected**
  React/Angular/Vue guides.
- `CHANGELOG.md`; make the example the canonical runnable reference.

## Phase 5 — v2.0: breaking polish (opt-in, with migration guide)

- Unify response shapes; normalize hook signatures (request + transaction
  manager); expose `this.options` to the service; custom-route registration via
  `@Crud`; pluggable/i18n messages; tighten public types.
- `MIGRATION.md` (v1 → v2) with a "minimum changes" checklist; publish on the
  `next` tag first, then promote to `latest`.
