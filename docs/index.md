---
layout: home

hero:
  name: nest-crud
  text: CRUD for NestJS + TypeORM
  tagline: Generate REST endpoints, rich filtering, relations, pagination and soft-delete from a single @Crud() decorator.
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: Querying
      link: /querying
    - theme: alt
      text: View on GitHub
      link: https://github.com/ack-solutions/nest-crud

features:
  - title: One decorator
    details: '@Crud({ entity, path, routes }) generates the full REST surface — list, read, create, update, delete, bulk, soft-delete.'
  - title: Rich querying
    details: 26 operators plus relations, select, order, pagination, counts and soft-delete — as a JSON query string.
  - title: Typed client
    details: Build the exact same queries on the frontend with @ackplus/nest-crud-request (React, Angular, Vue, Node).
  - title: Documented & tested
    details: Swagger metadata generated automatically, with a 150+ test suite guarding every release.
---
