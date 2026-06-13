# Packages & links

Everything in the `@ackplus/nest-crud` family, what it's for, and where to get it.
All packages are released **together at the same version** from the
[monorepo](https://github.com/ack-solutions/nest-crud).

## Server

### `@ackplus/nest-crud`

The NestJS + TypeORM CRUD generator — the `@Crud()` decorator, the query engine
(operators, relations, aggregates, soft-delete), Swagger generation, lifecycle
hooks, and the security guards.

- 📦 npm: <https://www.npmjs.com/package/@ackplus/nest-crud>
- 🧩 source: [`packages/nest-crud`](https://github.com/ack-solutions/nest-crud/tree/main/packages/nest-crud)
- 📖 start here: [Getting started](/getting-started) · [Querying](/querying)

```bash
npm i @ackplus/nest-crud
```

## Clients — build the query, on any platform

These build the **request query parameters** the server understands. They don't
make HTTP calls (use your own client). They produce **identical wire formats**, so
a query behaves the same on every platform.

### `@ackplus/nest-crud-request` — JavaScript / TypeScript

For **React, Angular, Vue, Node**, and any TS app.

- 📦 npm: <https://www.npmjs.com/package/@ackplus/nest-crud-request>
- 🧩 source + README: [`packages/nest-crud-request`](https://github.com/ack-solutions/nest-crud/tree/main/packages/nest-crud-request)
- 📖 guides: [Querying → Client query builder](/querying#client-query-builder) ·
  [React](/frameworks/react) · [Angular](/frameworks/angular) · [Vue](/frameworks/vue)

```bash
npm i @ackplus/nest-crud-request
```

### `nest_crud_request` — Dart / Flutter

The Dart twin of the JS query builder, for **Flutter** and Dart apps.

- 📦 pub.dev: <https://pub.dev/packages/nest_crud_request>
- 🧩 source + README: [`clients/flutter/nest_crud_request`](https://github.com/ack-solutions/nest-crud/tree/main/clients/flutter/nest_crud_request)
- 📖 guide: [Flutter / Dart](/frameworks/flutter)

```yaml
# pubspec.yaml
dependencies:
  nest_crud_request: ^1.1.42
```

## Which do I use?

| You're building… | Use |
| --- | --- |
| The API (NestJS backend) | `@ackplus/nest-crud` |
| A React / Angular / Vue / Node client | `@ackplus/nest-crud-request` |
| A Flutter / Dart app | `nest_crud_request` |

The two client builders mirror each other method-for-method and operator-for-operator
(pinned by drift-guard tests), so you can move a query between platforms unchanged.

## Repo & releases

- GitHub: <https://github.com/ack-solutions/nest-crud>
- Changelog: <https://github.com/ack-solutions/nest-crud/blob/main/CHANGELOG.md>
- Migration (v1 → v2): [Migration guide](./migration.md)
- Example app (real Postgres): [`apps/example-app`](https://github.com/ack-solutions/nest-crud/tree/main/apps/example-app)

A single git tag (`1.2.3`) publishes the npm packages **and** the pub.dev package
at that version.
