# nest-crud

A monorepo for one server package and two client query builders (JS + Dart):

| Package | Registry | Purpose |
| --- | --- | --- |
| [`@ackplus/nest-crud`](./packages/nest-crud) | [npm](https://www.npmjs.com/package/@ackplus/nest-crud) | NestJS + TypeORM CRUD generator — `@Crud()` decorator, `CrudService<T>`, request parser, Swagger metadata |
| [`@ackplus/nest-crud-request`](./packages/nest-crud-request) | [npm](https://www.npmjs.com/package/@ackplus/nest-crud-request) | Framework-agnostic JS/TS query builder for React, Angular, Vue, Node |
| [`nest_crud_request`](./clients/flutter/nest_crud_request) | [pub.dev](https://pub.dev/packages/nest_crud_request) | The Dart/Flutter twin of the query builder — same wire format |

All three share the same request-query format (`where`, `relations`, `select`, `order`, `aggregates`, `having`, `take`, `skip`, `withDeleted`, `onlyDeleted`), so a query built with either client works against a `nest-crud` server. The two client builders are pinned to the server's operator set by drift-guard tests, and **publish together at one version from one git tag**.

## Which one do I read?

- Backend (NestJS + TypeORM): [`packages/nest-crud/README.md`](./packages/nest-crud/README.md)
- JS / TS client (React, Angular, Vue, Node): [`packages/nest-crud-request/README.md`](./packages/nest-crud-request/README.md)
- Flutter / Dart client: [`clients/flutter/nest_crud_request/README.md`](./clients/flutter/nest_crud_request/README.md) · [guide](./docs/frameworks/flutter.md)
- All packages at a glance: [`docs/packages.md`](./docs/packages.md)

## Install

```bash
# backend
npm install @ackplus/nest-crud

# JS / TS client
npm install @ackplus/nest-crud-request
```

```yaml
# Flutter / Dart client — pubspec.yaml
dependencies:
  nest_crud_request: ^1.1.42
```

They can be used independently. You don't need a client package on the backend, and you don't need `nest-crud` on the frontend.

## What you get

- Generated REST routes from a single `@Crud({ path, entity, routes })` decorator
- Reusable `CrudService<T>` with 15+ CRUD actions and lifecycle hooks
- Rich query format: filters, relations, select, sort, pagination, soft-delete
- **29 comparison operators** (incl. `$exists`/`$notExists`, `$ieq`) plus `$and` / `$or`, and a registry for custom operators
- **Aggregates** — `count`/`sum`/`avg`/`min`/`max` over relations, with `having` and per-aggregate `where`
- **Hide sensitive columns/relations** from the whole query surface with `@CrudHidden()` / `hiddenFields`
- Bulk create / update / delete / restore
- Soft-delete aware (trash & restore routes)
- `reorder` support via `BaseEntityWithOrder`
- Swagger / OpenAPI metadata applied automatically
- Type-safe query builders (`QueryBuilder`, `WhereBuilder`) for **JS/TS and Dart/Flutter** clients

## Gotchas worth knowing up front

- `@Crud()` already applies `@Controller(...)` — put `path` inside `@Crud()`, don't stack a second `@Controller()`.
- Update is `PUT /:id`, not `PATCH`.
- `GET /resource` is `findMany` and returns `{ items, total }`.
- `GET /resource/get/all` is `findAll` and returns `T[]`.
- `BaseEntity` uses a UUID primary key named `id`. The service assumes the primary key is named `id`.
- Soft-delete routes (`/:id/restore`, `/:id/trash`, `/restore/bulk`, `/trash/bulk`) are only generated when `softDelete: true`.
- List routes enforce `maxPerPage` (defaults to 5000 via `CrudConfigService`).

## Documentation

Full guides live in [`docs/`](./docs/) (also hosted at <https://ack-solutions.github.io/nest-crud/>):

- [Getting started](./docs/getting-started.md) — entity → service → controller → first request
- [Querying](./docs/querying.md) — operators, relations, pagination, aggregates, `having`, hidden fields, counts, soft-delete, bulk
- [Packages & links](./docs/packages.md) — all three packages, npm/pub.dev/source links
- [Configuration](./docs/configuration.md) · [Lifecycle hooks](./docs/lifecycle-hooks.md) · [Auth & guards](./docs/auth-and-guards.md)
- [Soft delete](./docs/soft-delete.md) · [Error handling](./docs/error-handling.md) · [Troubleshooting](./docs/troubleshooting.md)
- Client guides: [React](./docs/frameworks/react.md) · [Angular](./docs/frameworks/angular.md) · [Vue](./docs/frameworks/vue.md) · [Flutter / Dart](./docs/frameworks/flutter.md)
- [Changelog](./CHANGELOG.md) · [Roadmap](./docs/ROADMAP.md)

## Repo layout

```
packages/
  nest-crud/                      # backend package (npm)
  nest-crud-request/              # JS/TS client query builder (npm)
clients/
  flutter/nest_crud_request/      # Dart/Flutter client query builder (pub.dev)
apps/
  example-app/                    # working NestJS demo (real Postgres)
```

## License

MIT © Ackplus
