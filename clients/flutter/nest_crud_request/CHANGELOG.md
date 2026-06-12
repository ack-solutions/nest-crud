## 1.2.0

- Initial release. Dart / Flutter query builder for `@ackplus/nest-crud`, the twin
  of the JS `@ackplus/nest-crud-request`. Build `where` (all 29 operators + `$and`/
  `$or`), `relations` (select / where / joinType), `aggregates` + per-aggregate
  `where` + `having`, `order`, pagination and soft-delete flags. Produces identical
  wire query strings; released together with the JS packages at the same version.
