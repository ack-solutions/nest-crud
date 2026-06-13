# Error handling

The library throws standard NestJS HTTP exceptions, so they render through your
app's exception filter like any other. The default body shape is:

```json
{ "statusCode": 400, "message": "…", "error": "Bad Request" }
```

For validation errors, `message` is an array of strings.

## Status codes

| Status | When |
| --- | --- |
| `200 OK` | successful read, update, delete, restore |
| `201 Created` | successful `create` / `createMany` |
| `400 Bad Request` | invalid input (see below) |
| `404 Not Found` | `findOne` / `update` / `delete` / `restore` / trash on a missing row |

## What raises `400`

- Malformed JSON in `where` / `relations` / `order` / `select` / `aggregates` / `having`.
- An **unknown filter field** in `where` (only real columns and relation paths are allowed).
- An **unknown `order` key** — a column/alias the query doesn't expose. (Unknown order
  keys are rejected rather than silently ignored; see [Migration](./migration.md).)
- A [**hidden field**](./querying.md#hiding-sensitive-fields) (`@CrudHidden()` /
  `hiddenFields`) named in `where` / `order` / `relations` / an aggregate `field`.
  The error is identical to "unknown field" so the field's existence isn't revealed.
- An unsupported operator, e.g. a typo like `$gtt`.
- `$in` / `$notIn` / `$inL` / `$notinL` given a non-array value.
- `$between` / `$notBetween` not given a `[start, end]` pair.
- An **aggregate** with an invalid `field` (must be a relation path like `posts.id`),
  a bad `as` alias (must match `^[A-Za-z_][A-Za-z0-9_]*$`), or one colliding with a real column.
- A `having` key that isn't a defined aggregate alias.
- `take` (page size) greater than `maxPerPage`.
- An invalid `groupByKey` on `counts`.
- An empty body on `create`.
- Postgres-only operators (`$contArr`, `$intersectsArr`) on a non-Postgres database.
- Any failure from your DTO / `class-validator` rules (when validation is enabled).

## What raises `404`

`findOne`, `update`, `delete`, `restore`, and `deleteFromTrash` throw
`NotFoundException` when no row matches the id/criteria.

## Customising errors

Catch and reshape these with a standard NestJS
[exception filter](https://docs.nestjs.com/exception-filters). All exceptions are
`HttpException` subclasses (`BadRequestException`, `NotFoundException`), so a
global filter can map them to your own envelope.

The Swagger document already includes reusable `ErrorResponseDto` and
`ValidationErrorResponseDto` schemas for these responses.
