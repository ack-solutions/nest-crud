# nest-crud

A monorepo for two complementary packages:

| Package | Purpose |
| --- | --- |
| [`@ackplus/nest-crud`](./packages/nest-crud) | NestJS + TypeORM CRUD generator — `@Crud()` decorator, `CrudService<T>`, request parser, Swagger metadata |
| [`@ackplus/nest-crud-request`](./packages/nest-crud-request) | Framework-agnostic query builder for frontends and shared TypeScript code |

Both share the same request-query format (`where`, `relations`, `select`, `order`, `take`, `skip`, `withDeleted`, `onlyDeleted`), so clients built with `nest-crud-request` work against servers built with `nest-crud`.

## Which one do I read?

- Backend (NestJS + TypeORM): [`packages/nest-crud/README.md`](./packages/nest-crud/README.md)
- Frontend / shared client (React, Angular, Vue, Node): [`packages/nest-crud-request/README.md`](./packages/nest-crud-request/README.md)

## Install

```bash
# backend
npm install @ackplus/nest-crud

# client
npm install @ackplus/nest-crud-request
```

They can be used independently. You don't need `nest-crud-request` on the backend, and you don't need `nest-crud` on the frontend.

## What you get

- Generated REST routes from a single `@Crud({ path, entity, routes })` decorator
- Reusable `CrudService<T>` with 15+ CRUD actions and lifecycle hooks
- Rich query format: filters, relations, select, sort, pagination, soft-delete
- 26 comparison operators plus `$and` / `$or`
- Bulk create / update / delete / restore
- Soft-delete aware (trash & restore routes)
- `reorder` support via `BaseEntityWithOrder`
- Swagger / OpenAPI metadata applied automatically
- Type-safe query builder (`QueryBuilder`, `WhereBuilder`) for clients

## Gotchas worth knowing up front

- `@Crud()` already applies `@Controller(...)` — put `path` inside `@Crud()`, don't stack a second `@Controller()`.
- Update is `PUT /:id`, not `PATCH`.
- `GET /resource` is `findMany` and returns `{ items, total }`.
- `GET /resource/get/all` is `findAll` and returns `T[]`.
- `BaseEntity` uses a UUID primary key named `id`. The service assumes the primary key is named `id`.
- Soft-delete routes (`/:id/restore`, `/:id/trash`, `/restore/bulk`, `/trash/bulk`) are only generated when `softDelete: true`.
- List routes enforce `maxPerPage` (defaults to 5000 via `CrudConfigService`).

## Repo layout

```
packages/
  nest-crud/            # backend package
  nest-crud-request/    # client query builder
apps/
  example-app/          # working NestJS demo
```

## License

MIT © Ackplus
