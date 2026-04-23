# nest-crud Monorepo

This repo contains two packages:

- [`@ackplus/nest-crud`](./packages/nest-crud/README.md): NestJS + TypeORM CRUD generation
- [`@ackplus/nest-crud-request`](./packages/nest-crud-request/README.md): query builder for frontend or shared TypeScript code

## Which README To Use

- Read [`packages/nest-crud/README.md`](./packages/nest-crud/README.md) if you are building backend CRUD APIs in NestJS.
- Read [`packages/nest-crud-request/README.md`](./packages/nest-crud-request/README.md) if you need to build compatible query params from React, Angular, Vue, or shared utilities.
- Read [`apps/example-app/README.md`](./apps/example-app/README.md) only if you want a working demo app.

## What The Repo Provides

- Generated CRUD routes with `@Crud()`
- Reusable `CrudService<T>` for TypeORM repositories
- Filtering, relations, select, sorting, pagination, and soft-delete query parsing
- Shared request-builder package using the same query format

## Important Runtime Notes

- `@Crud()` already applies `@Controller(...)`. Set `path` inside `@Crud()`.
- Use explicit route objects such as `findMany: { enabled: true }`.
- `GET /resource` is `findMany()` and returns `{ items, total }`.
- `GET /resource/get/all` is `findAll()` and returns `T[]`.
- Generated update routes use `PUT`, not `PATCH`.
- The current service logic assumes the primary key field is named `id`.

## Standard Documentation Structure

This repo now uses a smaller documentation layout:

- `README.md`
- `packages/nest-crud/README.md`
- `packages/nest-crud-request/README.md`
- `apps/example-app/README.md`

Everything else in the repo should be treated as source code or supplementary examples, not primary documentation.
