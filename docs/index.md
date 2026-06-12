---
layout: home

hero:
  name: nest-crud
  text: CRUD for NestJS + TypeORM
  tagline: Generate REST endpoints with rich filtering, relations, aggregates, pagination and soft-delete from a single @Crud() decorator.
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: Querying
      link: /querying
    - theme: alt
      text: Packages
      link: /packages
    - theme: alt
      text: View on GitHub
      link: https://github.com/ack-solutions/nest-crud

features:
  - title: One decorator
    details: '@Crud({ entity, path, routes }) generates the full REST surface — list, read, create, update, delete, bulk, soft-delete and reorder.'
  - title: Rich querying
    details: 29 operators (incl. $exists, $ieq) plus relations, select, multi-sort, pagination, counts and custom operators — all as a JSON query string.
  - title: Aggregates & security
    details: Per-row count/sum/avg/min/max over relations with HAVING and per-aggregate filters; hide sensitive columns/relations with @CrudHidden().
  - title: Clients everywhere
    details: Build the exact same queries from React, Angular, Vue and Node (@ackplus/nest-crud-request) or Flutter/Dart (nest_crud_request) — identical wire format.
  - title: Documented & tested
    details: Swagger generated automatically, 190+ tests plus a real-Postgres e2e suite, gating every release.
---
