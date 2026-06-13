## 1.3.0

- Version aligned with the `@ackplus/nest-crud` 1.3.0 release (server-side: a
  `@nestjs/swagger@11.4` import-crash fix and tenant-scopable mutations). No changes
  to the Dart query builder itself — all packages release together at one version.

## 1.2.0

- Initial release. Dart / Flutter query builder for `@ackplus/nest-crud`, the twin
  of the JS `@ackplus/nest-crud-request`. Build `where` (all 29 operators + `$and`/
  `$or`), `relations` (select / where / joinType), `aggregates` + per-aggregate
  `where` + `having`, `order`, pagination and soft-delete flags. Produces identical
  wire query strings; released together with the JS packages at the same version.
