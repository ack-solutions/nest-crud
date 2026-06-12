# Migrating from v1 to v2

v2 is a small, focused breaking release that builds on top of the non-breaking
1.2.x improvements. **Most applications need no code changes.**

## Breaking changes

### 1. Unified mutation response shape

Every mutating endpoint now returns the same `{ success: true, message: string }`
envelope:

| Endpoint | v1 response | v2 response |
| --- | --- | --- |
| `DELETE /:id` | `{ message }` | `{ success: true, message }` |
| `DELETE /delete/bulk` | `{ message }` | `{ success: true, message }` |
| `PUT /reorder` | *(empty body)* | `{ success: true, message }` |
| `restore`, `restoreMany`, `…/trash` | `{ success, message }` | *(unchanged)* |

**What to do:**
- Reading `message`? No change.
- Asserting on the *exact* delete body? Add `success: true`.
- Relying on `reorder` returning no body? It now returns a small JSON object.

This change is additive for delete/deleteMany (a new field), so most clients are
unaffected.

### 2. Removed `CRUD_AUTH_OPTIONS_METADATA`

This exported constant was a metadata key for a feature that was never
implemented. It has been removed.

**What to do:** remove any `import { CRUD_AUTH_OPTIONS_METADATA }` (extremely
unlikely to exist in real code).

## Not changed

The query format, generated routes, `@Crud()` options, lifecycle hooks, entity
base classes, and the `@ackplus/nest-crud-request` client are all identical to
v1.2.x.

## New in v2 (non-breaking additions)

- **Configurable response messages (i18n).** Override the delete / restore /
  reorder messages globally; omitted keys keep the English default:
  ```ts
  CrudConfigService.load({
    messages: { deleted: 'Eliminado', restored: 'Restaurado', reordered: 'Reordenado' },
  });
  ```

## New in v2.1 (non-breaking additions)

`2.1.0` is **purely additive** over `2.0.0` — upgrade with no code changes. See
[Querying → Aggregates](./docs/querying.md#aggregates).

- **Aggregates + `having` + order-by-aggregate.** Attach per-row
  `count`/`sum`/`avg`/`min`/`max` over a relation, filter on them, and sort by them:
  ```
  GET /users?aggregates=[{"fn":"count","field":"posts.id","as":"postCount"}]&having={"postCount":{"$gt":5}}&order={"postCount":"DESC"}
  ```
- **Hidden / sensitive fields.** `@CrudHidden()` on a column/relation (or
  `@Crud({ hiddenFields })`) removes it from responses and blocks it in
  `where` / `order` / `aggregates` / `relations`. The previously-inert
  `hiddenFields` option is now enforced.
- **New operators.** `$ieq` (case-insensitive equality), `$exists` / `$notExists`
  (relation existence).
- **Custom operators.** `WhereOperatorRegistry.register(token, handler)` to add your
  own without forking.
- **Service extension points.** Override `createFindQueryBuilder()` /
  `createAggregateQueryBuilder()` in a subclass.
- **Client builder.** `.addAggregate()`, `.having()`, `.removeAggregate()`.

One behaviour tightening to be aware of: in an **aggregate** query, an unknown
`order` key now returns `400` (only aggregate aliases and root columns are
sortable). Plain (non-aggregate) queries are unchanged. An explicit `select` now
always includes the primary key so nested relations keep hydrating.

## Already supported — no change needed

- **Custom / extra routes.** Add standard NestJS route methods (`@Get`, `@Post`, …)
  to your `@Crud` controller; they coexist with the generated routes, and the
  factory registers generated routes *after* your custom ones, so a custom
  `@Get('active')` is never shadowed by `GET /:id`.

## Planned for later v2.x

- Normalized lifecycle-hook signatures (consistent `request` / transaction args).
- `this.options` available inside `CrudService` (deferred — needs request scoping
  to remain safe with singleton service instances).

## Upgrading

```bash
npm install @ackplus/nest-crud@^2 @ackplus/nest-crud-request@^2
```

v2 is published on the `next` dist-tag first; once validated it is promoted to
`latest`.
