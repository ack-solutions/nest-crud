# Troubleshooting

## My CRUD routes return 404

Almost always one of:

1. **You stacked a second `@Controller()`.** `@Crud()` already applies
   `@Controller(path)`. Adding another `@Controller('users')` underneath it breaks
   route registration. Put the path inside `@Crud({ path: 'users' })` and remove
   the extra decorator.
2. **No `path` (and you removed `@Controller`).** Without `path`, the controller
   mounts at the entity name (e.g. `/User`). Set `path: 'users'`.
3. **The route is disabled.** Routes you list with `{ enabled: false }` (or the
   shorthand `false`) are not registered.

## "Service is not defined…"

The controller must expose the service as a property literally named `service`:

```ts
export class UserController {
  constructor(public service: UserService) {} // ← `public service`
}
```

## A custom endpoint clashes with `/:id`

Define custom static routes (e.g. `@Get('active')`) in the controller body — they
are registered before the generated `/:id` route, so `/users/active` won't be
captured as `findOne('active')`. The generated `/bulk` and `/reorder` routes are
likewise ordered ahead of `/:id`.

## `?withDeleted=true` (or `onlyDeleted`) returns 400

Fixed in the current version — these flags now coerce `"true"`/`"1"` to booleans.
If you still see it, make sure you're on the latest release.

## Filtering by a column returns 400 "Invalid filter field"

Only real entity columns and resolvable relation paths are accepted in `where`.
Check the spelling, and for relation columns include the relation:
`relations=["profile"]&where={"profile.age":{"$gte":18}}`.

## A big filter returns `414` (or the request is rejected)

A long query (a `$in` with many IDs, a large saved filter) can exceed the URL limit
that proxies/CDNs enforce (~8 KB → `414 Request-URI Too Large`). Keep reads as GET for
the common case, and send the rare large query in a POST body handled as a GET — see
[Large queries](./large-queries.md).

## Postgres array operators error on SQLite/MySQL

`$contArr` and `$intersectsArr` are PostgreSQL-only and return 400 elsewhere.

## An aggregate or `having` returns 400

- The aggregate `field` must be a **relation path** (`posts.id`), not a plain column.
- The `as` alias must match `^[A-Za-z_][A-Za-z0-9_]*$` and not collide with a real column.
- A `having` key must reference an **alias you defined** in `aggregates` for the same
  request. See [Querying → Aggregates](./querying.md#aggregates).

## A column I expected is missing / a field returns 400 "unknown field"

It may be **hidden**. Fields marked with [`@CrudHidden()`](./querying.md#hiding-sensitive-fields)
or listed in `@Crud({ hiddenFields })` are stripped from responses and rejected in
`where` / `order` / `aggregates` / `relations` — by design, with the same error as an
unknown field. Check your entity for `@CrudHidden()` and the controller for `hiddenFields`.

## My Flutter/JS client sends a query the server rejects

The client builders ([`@ackplus/nest-crud-request`](https://www.npmjs.com/package/@ackplus/nest-crud-request),
[`nest_crud_request`](https://pub.dev/packages/nest_crud_request)) emit the exact wire
format the server parses — keep the client version in step with the server. Both
clients are pinned to the server's operator set by drift-guard tests, so a mismatch
usually means a version skew. See [Packages & links](./packages.md).

## Peer dependency warnings on install

The package peer-depends on NestJS 10/11, TypeORM 0.3, `class-validator`,
`class-transformer`, and `@nestjs/swagger`. Install versions that match your app.

## Soft-delete routes don't exist

`/:id/restore`, `/:id/trash`, `/restore/bulk`, `/trash/bulk` are only generated
when you pass `softDelete: true` to `@Crud()`.
