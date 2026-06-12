# Configuration

## `@Crud(options)`

| Option | Type | Description |
| --- | --- | --- |
| `entity` | class | **Required.** The TypeORM entity. |
| `path` | string | URL path the controller mounts at (e.g. `'users'`). Defaults to the entity name. |
| `name` | string | Override the name used for Swagger tags / operation ids. |
| `routes` | object | Per-route config — see below. |
| `softDelete` | boolean | Enable soft-delete + the trash/restore routes. |
| `maxPerPage` | number | Max page size for list queries (default 5000). `maxPageSize` is a legacy alias. |
| `select` | string[] | Default columns to select when the request doesn't specify `select`. |
| `hiddenFields` | string[] | Columns/relations to hide from the entire query surface (never selected, rejected in `where`/`order`/`aggregates`). Per-controller alternative to the [`@CrudHidden()`](./querying.md#hiding-sensitive-fields) decorator. |
| `query.relations` | string[] | Relations always joined for this controller. |
| `messages` | object | Override delete/restore/reorder response messages (i18n) — `{ deleted, noItemsToDelete, restored, reordered }`. |
| `validation` | ValidationPipeOptions \| false | Options for the per-route `ValidationPipe`, or `false` to disable generated validation. |
| `dto.create` / `dto.update` | class | Custom request-body DTOs. When omitted, a DTO derived from the entity (minus `id`/timestamps) is used. |
| `debug` | boolean | Verbose query logging (also toggled by the `NEST_CRUD_DEBUG` env var). |

### `routes`

Each route accepts `{ enabled, guards, interceptors, decorators }` (or the boolean
shorthand `true` / `false`). All routes are enabled by default; list a route with
`{ enabled: false }` to remove it.

```ts
@Crud({
  entity: User,
  path: 'users',
  softDelete: true,
  routes: {
    create:  { enabled: true, guards: [JwtAuthGuard] },
    delete:  { enabled: true, guards: [JwtAuthGuard, AdminGuard] },
    findMany:{ enabled: true, interceptors: [CacheInterceptor] },
    reorder: false, // not an ordered entity → disable
  },
})
```

The route names are: `findMany`, `findAll`, `counts`, `findOne`, `create`,
`createMany`, `update`, `updateMany`, `delete`, `deleteMany`, `deleteFromTrash`,
`deleteFromTrashMany`, `restore`, `restoreMany`, `reorder`.

## Generated routes

| Action | Method & path | Returns |
| --- | --- | --- |
| findMany | `GET /` | `{ items, total }` |
| findAll | `GET /get/all` | `T[]` |
| counts | `GET /get/counts` | `{ total, data? }` |
| findOne | `GET /:id` | `T` |
| create | `POST /` | `T` (201) |
| createMany | `POST /bulk` | `T[]` (201) |
| update | `PUT /:id` | `T` |
| updateMany | `PUT /bulk` | `T[]` |
| delete | `DELETE /:id` | `{ message }` |
| deleteMany | `DELETE /delete/bulk?ids=…` | `{ message }` |
| reorder | `PUT /reorder` | — |
| deleteFromTrash † | `DELETE /:id/trash` | `{ success, message }` |
| deleteFromTrashMany † | `DELETE /trash/bulk?ids=…` | `{ success, message }` |
| restore † | `PUT /:id/restore` | `{ success, message }` |
| restoreMany † | `PUT /restore/bulk` | `{ success, message }` |

† only generated when `softDelete: true`.

## Hiding sensitive fields

`hiddenFields` (and the `@CrudHidden()` entity decorator) remove columns or
relations from the generated query surface entirely — they're never returned,
and naming one in `where` / `order` / `aggregates` / `relations` returns `400`,
indistinguishable from an unknown field. This is a recently added security
control; the full behaviour table and examples live in
[Querying → Hiding sensitive fields](./querying.md#hiding-sensitive-fields).

```ts
@Crud({ entity: User, path: 'users', hiddenFields: ['passwordHash', 'auditLogs'] })
export class UserController {
  constructor(public service: UserService) {}
}
```

## Response messages (i18n)

Override the messages returned by delete / restore / reorder — per controller via
`messages`, or globally via `CrudConfigService`. Any omitted key falls back to the
English default.

```ts
@Crud({
  entity: User,
  path: 'users',
  messages: {
    deleted: 'Utilisateur supprimé',
    restored: 'Utilisateur restauré',
    reordered: 'Ordre mis à jour',
    noItemsToDelete: 'Aucun élément à supprimer',
  },
})
```

## Global defaults — `CrudConfigService`

Set defaults for every controller once, at bootstrap:

```ts
import { CrudConfigService } from '@ackplus/nest-crud';

CrudConfigService.load({
  maxPerPage: 1000,        // or the legacy `maxPageSize` alias
  // messages: { ... },    // default response messages for all controllers
  // routes: { ... },      // override default route config globally
});
```

## See also

- [Querying](./querying.md) — every operator, relations, aggregates, `having`, hiding fields.
- [Packages & links](./packages.md) — the npm and pub.dev client builders that produce these queries.
