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

- An explicit `select` now always includes the entity's primary key, so nested
  relations hydrate and entity identity is preserved when `select` omits the id.
- The 23-operator `where` builder was refactored to a registry (behaviour and
  emitted SQL are identical for existing operators).

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
