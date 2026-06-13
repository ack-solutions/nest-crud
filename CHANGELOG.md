# Changelog

All notable changes to `@ackplus/nest-crud` and `@ackplus/nest-crud-request` are
documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [2.1.0] — unreleased (v2 track)

**Additive and non-breaking** over `2.0.0` — no code changes required to upgrade.
Advanced querying: per-row aggregates, `having`, more operators, and extension
points. See [Querying → Aggregates](./docs/querying.md#aggregates).

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
- **Write-side scoping hooks** — `beforeMutate(criteria, action)` augments the WHERE
  for `update` / `delete` / `deleteFromTrash` / `restore` and their bulk variants
  (the write-side counterpart to `beforeFindMany` / `beforeFindOne`), so mutations
  can be tenant-scoped in one place. `reorder` gains a `beforeReorder(ids)` hook and
  a configurable `reorderColumn` (default `order`, e.g. set `sortOrder`); it now
  throws `400` if that column doesn't exist. See
  [Securing mutations](./docs/lifecycle-hooks.md#securing-mutations-write-side-scoping).
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

### Notes

- Order keys in an **aggregate** query are restricted to aggregate aliases and
  root columns; an unknown key returns `400` (the non-aggregate path is unchanged).
- Aggregates cover single-level relations; many-to-many is not yet supported.

---

## [2.0.0] — unreleased (v2 track)

Breaking — see [MIGRATION.md](./MIGRATION.md). Includes everything below plus:

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

## [1.2.0] — unreleased (v1.x track)

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
