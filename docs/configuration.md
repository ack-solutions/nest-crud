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
| `query.relations` | string[] | Relations always joined for this controller. |
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

## Global defaults — `CrudConfigService`

Set defaults for every controller once, at bootstrap:

```ts
import { CrudConfigService } from '@ackplus/nest-crud';

CrudConfigService.load({
  maxPageSize: 1000,
  // routes: { ... } // override default route config globally
});
```
