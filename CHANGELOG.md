# Changelog

All notable changes to `@ackplus/nest-crud` and `@ackplus/nest-crud-request` are
documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [2.2.0] — 2026-09-25

Security hardening of the write path, plus hook context for updates. All packages
release together at this version.

Released as a **minor**: the behaviours removed below were never documented or
supported, and every existing hook, route and client call keeps working. Most apps
upgrade with no code changes — see [Upgrading](#upgrading-to-220) below and the
[migration guide](./MIGRATION.md#upgrading-to-22-security-hardening-of-writes).

### Security

- **`create` / `createMany` always insert.** A body `id` passed the column filter
  and `repository.save()` treated it as "update this row": a `POST` carrying another
  tenant's id **overwrote that row** and moved it into the caller's tenant. A child
  row sent with an id (one-to-many, or the inverse side of a one-to-one) was
  re-parented and rewritten the same way. The generated primary key and the
  create / update / delete date and version columns are now dropped from the row
  and, recursively, from owned child rows **before** any hook runs. References
  (many-to-one objects, `...Id` columns, many-to-many links, the owning side of a
  one-to-one) keep their ids, so linking to existing rows works as before.
- **Updates can no longer rewrite server-managed columns.** A `PUT` body's
  `deletedAt` soft-deleted the row (bypassing the delete route, its guards and
  hooks) and `createdAt` backdated it. Update bodies now drop the create / update /
  delete date and version columns.
- **`reorder` goes through `beforeMutate`** like every other mutation (it wrote by
  raw id), so a tenant scope there also scopes reorder: ids outside the scope are
  not written. With the default (no-op) `beforeMutate` nothing changes.

### Added

- **Hook context on saves.** `beforeSave(data, request?, context?)` gets a third,
  optional argument `CrudSaveContext` — `{ action, oldData? }`. For `update` /
  `updateMany`, `oldData` is the stored row as loaded before the change, so a hook
  can merge a partial body or enforce "locked after confirm" rules without loading
  the row again. Existing two-argument overrides keep working.
- **`stripServerManagedFields(metadata, body)`** exported — the same create rule for
  your own (non-CRUD) create paths.
- **`prepareCreateData(data)` / `prepareUpdateData(data, oldData)`** — overridable
  service methods where the sanitizing happens (e.g. to keep client-generated ids).

### Changed

- On `update` / `updateMany`, the payload hooks receive now carries the **stored
  row's primary key** — previously it had no id, or whatever id the body sent. The
  save itself was already pinned to the loaded row and still is (also after hooks).
- A create body containing **only** server-managed fields (e.g. just `{ "id": … }`)
  now returns `400 No data provided for insert.` instead of rewriting that row.

### Upgrading to 2.2.0

- Hooks may still set any of the dropped fields — only the client body is cleaned.
- If you pre-saved child rows and then passed them (with their ids) into `create()`,
  remove the pre-save and let the cascade write them — their ids are now dropped, so
  they would be inserted twice.
- If clients supply their own ids on purpose (e.g. offline-generated UUIDs),
  override `prepareCreateData(data)` to return `data` unchanged, and guard against
  overwriting existing rows yourself.
- Entities with a client-supplied (non-generated) `@PrimaryColumn` keep it; `create`
  behaves as before for them.

## [2.1.1] — 2026-08-03

Patch on the 2.x line. All packages release together at this version.

### Fixed

- **`allowSoftDeleteFilter` now also gates `findOne`.** The hook (added in 2.1.0)
  covered `findMany` / `findAll` / `counts` and the aggregate path, but `findOne`
  built its query without it — so a denied caller could still fetch a single trashed
  row by id via `GET /:id?withDeleted=true`. `findOne` now applies the same gate, so
  the hook covers **every** read.

## [2.1.0] — 2026-07-30

Minor on the 2.x line — adds the `allowSoftDeleteFilter` hook and closes a read-path
scoping gap. All packages release together at this version.

### Security

- **The aggregate path no longer bypasses `beforeFindMany`.** A list request carrying
  a non-empty `aggregates` array short-circuited into the two-phase aggregate builder,
  which skipped `beforeFindMany` — so every tenant/visibility guard riding on that hook
  was bypassed for aggregate queries (e.g. `GET /polls?aggregates=[…]` could return
  other tenants' rows). `beforeFindMany` is now applied to the aggregate path's
  row-selection query, so the same scoping holds. (Reachable once a guarded entity
  declares a relation; caught before it went live.)

### Added

- **`allowSoftDeleteFilter(request)` hook** — gate the client soft-delete flags.
  `withDeleted` / `onlyDeleted` are query capabilities, not authorization; return
  `false` from this hook and they are forced off for the request (across `findMany` /
  `findAll` / `counts` and the aggregate path), so a caller can't read trashed rows via
  `?withDeleted=true`. Default is allowed (unchanged). See
  [Gating the soft-delete flags](./docs/lifecycle-hooks.md#gating-the-soft-delete-flags).

## [2.0.3] — 2026-07-14

Patch on the 2.x line. All packages release together at this version.

### Fixed

- **Bulk delete now accepts a single id.** `deleteMany` (`DELETE /delete/bulk`) and
  `deleteFromTrashMany` (`DELETE /trash/bulk`) read `ids` from the query and validated
  with `@IsArray()`. Over HTTP a one-element array serialises to a scalar (`?ids=x`) —
  Express only builds an array from repeated keys — so deleting exactly one row via the
  bulk route failed with `400 "ids must be an array"` (two+ ids worked). The delete DTO
  now coerces a scalar to a one-element array, and the service normalises `ids`
  defensively, so `?ids=x` works like `?ids=a&ids=b`. (`restoreMany` reads ids from the
  body and was unaffected.)

## [2.0.2] — 2026-06-13

Patch on the 2.x line. All packages release together at this version.

### Fixed

- **`counts` now honours the whole `filter`** — fixes both `where` and the
  soft-delete flags. `GET {resource}/get/counts` ran a JSON-string `filter` through
  `qs` instead of `JSON.parse`, so the **entire** filter was silently dropped:
  `where` was ignored and `withDeleted` / `onlyDeleted` never applied (counts always
  returned the active set). `counts()` now normalises the filter to an object first,
  so everything the [request query builder](./packages.md) puts in it is honoured —
  e.g. `?filter={"onlyDeleted":true}` or `?filter={"where":{…},"onlyDeleted":true}`
  (optionally with `groupByKey`). The soft-delete flags live **inside** `filter` (its
  `IFindManyOptions` shape already carries them) — no separate root query params. A
  malformed `filter` JSON now returns `400`.

## [2.0.1] — 2026-06-13

Patch on the 2.0.0 (v2) line. Makes the documented global-config entrypoint actually
importable. All packages release together at this version.

### Added

- **`NestCrudModule.forRoot(config)`** — register global CRUD defaults (`maxPerPage`
  / `maxPageSize`, i18n `messages`, route overrides) the idiomatic NestJS way (in a
  module's `imports`), equivalent to calling `CrudConfigService.load(config)` at
  bootstrap.

### Fixed

- **`CrudConfigService` is now exported from the package barrel.** The documented
  global-config entrypoint — `CrudConfigService.load({ maxPageSize, … })` — was
  declared but not re-exported from `index`, so the documented import didn't resolve.
  It's now part of the public API (with a regression test importing it from the entry).

## [1.3.0] — 2026-06-13

Non-breaking. A `@nestjs/swagger@11.4` runtime-crash fix and tenant-scopable
mutations. All packages (`@ackplus/nest-crud`, `@ackplus/nest-crud-request`,
`nest_crud_request`) release together at this version.

### Added

- **Write-side scoping hooks** — `beforeMutate(criteria, action)` augments the WHERE
  for `update` / `delete` / `deleteFromTrash` / `restore` and their bulk variants
  (the write-side counterpart to `beforeFindMany` / `beforeFindOne`), so mutations
  can be tenant-scoped in one place. `reorder` gains a `beforeReorder(ids)` hook and
  a configurable `reorderColumn` (default `order`, e.g. set `sortOrder`); it now
  throws `400` if that column doesn't exist. See
  [Securing mutations](./docs/lifecycle-hooks.md#securing-mutations-write-side-scoping).

### Fixed

- **Runtime crash on `@nestjs/swagger@11.4.x`**: the Swagger helper deep-imported
  `@nestjs/swagger/dist/constants`, which swagger 11 no longer exposes in its
  `exports` map — Node threw `ERR_PACKAGE_PATH_NOT_EXPORTED` at import time for
  consumers on that version (it compiled fine because `tsc` ignores `exports`). The
  helper now inlines the stable metadata keys instead. A new test guards against any
  `@nestjs/*/dist` or `/lib` deep import being reintroduced.

### Security

- **Mutations can now be tenant-scoped** via the new `beforeMutate` hook. Previously
  `update` / `delete` / `deleteFromTrash` / `restore` (and bulk) located rows by
  **id alone**, independent of the read hooks — so scoping only `beforeFindMany` /
  `beforeFindOne` left `PUT`/`DELETE /:id` cross-tenant exploitable (IDOR) unless the
  consumer guarded each write hook. Override `beforeMutate` (ideally on a base
  service) to AND a tenant column into every mutation's WHERE; non-matching rows then
  return `404` (single) or are skipped (bulk). Default behaviour is unchanged.
  `reorder` is likewise scopable via `beforeReorder`. See
  [Securing mutations](./docs/lifecycle-hooks.md#securing-mutations-write-side-scoping).

---

## v2 track — advanced querying (aggregates, HAVING, operators, extensibility)

> Historical: this section and the two below pre-date the tag-driven release flow
> and describe what shipped **cumulatively on the way to 2.0.0** — the registries
> went 1.2.x → 1.3.0 → 2.0.0, so these were never separate published versions.

**Additive** — per-row aggregates, `having`, more operators, and extension points.
See [Querying → Aggregates](./docs/querying.md#aggregates).

### Added

- **Aggregates** on list endpoints: `aggregates=[{ fn, field, as }]` attaches a
  `count` / `sum` / `avg` / `min` / `max` over a relation to each row. Implemented
  as correlated scalar subqueries (no row-multiplication) executed in two phases
  (compute keys + aggregates → reload entities by id), robust on
  Postgres / MySQL / SQLite.
- **Per-aggregate `where`** — an `AggregateSpec` can carry its own `where` to
  filter the related rows it counts/sums (e.g. count only published posts), using
  the same operator engine as the top-level `where`. Appended inside that
  aggregate's correlated subquery, so aggregates stay independent; unknown/hidden
  columns are rejected with `400`. Exposed on the client `addAggregate({ …, where })`.
- **`having`** — filter on aggregate aliases using the same operator syntax as
  `where`; `total` reflects the filter and is independent of pagination.
- **Order by aggregate alias** (alongside root columns).
- **Hidden / sensitive fields** — mark a column or relation with `@CrudHidden()`
  (or `@Crud({ hiddenFields })`) and it is dropped from responses and rejected in
  `where` / `order` / `aggregates` / `relations` (like an unknown field, so its
  existence isn't revealed). See
  [Querying → Hiding sensitive fields](./docs/querying.md#hiding-sensitive-fields).
- **New operators**: `$ieq` (case-insensitive equality), `$exists` / `$notExists`
  (relation existence).
- **Custom-operator registry** — `WhereOperatorRegistry.register()` /
  `unregister()` to add operators without forking.
- **Service extension points** — overridable `createFindQueryBuilder()` and
  `createAggregateQueryBuilder()`.
- Client builder (`@ackplus/nest-crud-request`): `addAggregate()`, `having()` /
  `andHaving()` / `orHaving()`, and `removeAggregate()`; aggregates / having are
  serialised in `toObject()` / `toJson()`. `addRelation()` now supports `joinType`
  (positional or `{ select, where, joinType }` object form); `RelationBuilder` is
  exported. Removed dead code; the README documents every operator with its type.

### Changed

- Swagger: the generated list endpoints now document the `aggregates` and `having`
  query parameters (with examples) alongside the existing `where` / `relations` /
  `order` / `select` / pagination / soft-delete params.
- Swagger usability: JSON-encoded query params (`where`, `relations`, `order`,
  `select`, `aggregates`, `having`, counts `filter`) are now documented as
  `type: string` with **JSON-string** examples derived from the **real entity**
  columns / relations (hidden ones excluded). Previously they used `oneOf`
  string/object schemas with object examples, which made Swagger UI's "Try it out"
  reject the value with "Parameter string value must be valid JSON" and show
  field names that didn't match the entity. Every example now submits as-is.
- The `apps/example-app` is now a full feature demo — User / Profile / Post /
  Comment with 1:1, 1:n and nested relations, hidden column + hidden relation,
  soft-delete, and seed data on boot — so every feature is testable from Swagger.
- An explicit `select` now always includes the entity's primary key, so nested
  relations hydrate and entity identity is preserved when `select` omits the id.
- The 23-operator `where` builder was refactored to a registry (behaviour and
  emitted SQL are identical for existing operators).

### Fixed

- **`createMany` reload**: bulk-create reloaded each saved row with a separate
  `findOneByOrFail` inside `Promise.all` — N concurrent queries on the transaction's
  single connection, which pg deprecates (and removes in pg@9). It now reloads all
  rows with a single `IN(...)` query (also fewer round-trips). Behaviour unchanged.
- **`PUT /reorder` over HTTP**: the route handler passed the validated body object
  (`{ ids: [...] }`) straight to `service.reorder()` (which expects an id array),
  so with validation enabled reordering silently did nothing. The handler now
  unwraps `ids`. The documented body is `{ "ids": [...] }` (the old raw-array
  example was incorrect). Covered by a new HTTP reorder test and the Postgres e2e
  suite in `apps/example-app`.

### Notes

- Order keys in an **aggregate** query are restricted to aggregate aliases and
  root columns; an unknown key returns `400` (the non-aggregate path is unchanged).
- Aggregates cover single-level relations; many-to-many is not yet supported.

## v2 track — response unification & removals (breaking)

See [MIGRATION.md](./MIGRATION.md). Includes everything below plus:

### Added

- Configurable / i18n response messages via `CrudConfigService.load({ messages })`
  (delete / restore / reorder; omitted keys keep the English default).

### Changed (breaking)

- Mutation endpoints now share a unified `{ success, message }` response.
  `delete` / `deleteMany` gain a `success: true` field; `reorder` now returns a
  body (it previously returned none).

### Removed

- The unused `CRUD_AUTH_OPTIONS_METADATA` export.

---

## v1.2 track — hardening, tests & docs

A non-breaking hardening, testing, and documentation release. Existing apps
upgrade with no code changes.

### Added

- Full HTTP route test suite over an in-memory database, plus coverage for
  soft-delete, bulk operations, per-route guards/interceptors, lifecycle hooks,
  and a Swagger contract test (150+ tests, CI-gated).
- A column / relation **allowlist** for `where` filters — unknown fields are now
  rejected with `400` instead of producing a database error.
- Developer documentation under [`docs/`](./docs/) (getting-started, querying,
  configuration, lifecycle hooks, soft-delete, auth & guards, error handling,
  troubleshooting) and a `CHANGELOG`.
- `LICENSE` files (MIT) in the repo and both packages.

### Fixed

- **Route ordering**: `updateMany` (`PUT /bulk`) and `reorder` (`PUT /reorder`)
  were shadowed by `PUT /:id` and returned 404. Static routes are now registered
  before parameterised ones.
- The boolean route shorthand `routes: { x: true | false }` now works (previously
  it silently registered nothing).
- `findOne` now honours the query builder returned by `beforeFindOne` (it was
  discarded, bypassing scoping/tenant hooks on single reads).
- `counts()` uses the entity's real primary key instead of a hardcoded `"id"`
  (works for non-`id` primary keys) and guards an empty result.
- `createMany()` returns fully reloaded entities (generated columns/defaults
  present), matching `create()`.
- `reorder()` runs inside a transaction.
- `?withDeleted=true` / `?onlyDeleted=true` no longer fail validation (`400`)
  under a global `ValidationPipe`; the two flags are handled independently.
- Empty `$notIn` / `$notinL` now match everything instead of producing invalid
  SQL; `$between` requires a `[start, end]` array; `$in`/`$notIn` require arrays.
- Empty-body `create` and an invalid `groupByKey` now return `400` instead of `500`.
- The Swagger page-size cap honours both `maxPerPage` and the legacy `maxPageSize`.

### Changed

- Create/update request bodies now document only writable fields — server-managed
  `id`, `createdAt`, `updatedAt`, and `deletedAt` are hidden from the Swagger
  schema. Runtime behaviour is unchanged.
- `id` path parameters are documented with `format: uuid`.
- Build/test tooling standardised on pnpm + tsc + jest; tests are runnable and run
  in CI on every PR. Publishing is consolidated on the tag-based workflow.

## [1.1.42] and earlier

See the Git history for prior releases.
