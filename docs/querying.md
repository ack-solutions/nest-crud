# Querying

All list endpoints (`findMany`, `findAll`, `counts`) accept the same query
parameters. Each can be sent as a **JSON string** (recommended) or as bracket /
dot notation. The client builder [`@ackplus/nest-crud-request`](https://github.com/ack-solutions/nest-crud/tree/main/packages/nest-crud-request)
produces exactly this format.

```
GET /users?where={"isActive":true}&relations=["posts"]&order={"createdAt":"DESC"}&take=20&skip=0
```

> All examples below use the raw `GET` form for clarity. In a real app you'll
> usually build these with the [client query builder](#client-query-builder)
> instead of hand-writing the query string.

> **Very large filter?** A query too long for the URL (~8 KB, e.g. a `$in` with
> hundreds of IDs) can be sent in a POST body and handled as a GET — see
> [Large queries](./large-queries.md).

## Common queries (cheat sheet)

Copy-paste starting points — each is explained in detail in the sections below.

```bash
# 1. Active adults, newest first, first page of 20
GET /users?where={"status":"active","age":{"$gte":18}}&order={"createdAt":"DESC"}&take=20

# 2. Case-insensitive name search (contains "jo")
GET /users?where={"name":{"$iLike":"%jo%"}}

# 3. Users who have at least one post, with those posts joined
GET /users?where={"posts":{"$exists":true}}&relations=["posts"]

# 4. Only the columns you need, with the profile relation
GET /users?select=["id","name"]&relations=[{"profile":{"select":["bio"]}}]

# 5. Top authors: attach postCount, keep only > 5, sort by it
GET /users?aggregates=[{"fn":"count","field":"posts.id","as":"postCount"}]&having={"postCount":{"$gt":5}}&order={"postCount":"DESC"}

# 6. Created in a date range
GET /users?where={"createdAt":{"$between":["2026-01-01","2026-03-31"]}}

# 7. Any of several statuses (IN), excluding two ids
GET /users?where={"status":{"$in":["active","trial"]},"id":{"$notIn":["u1","u2"]}}

# 8. Active AND (admin OR owner)
GET /users?where={"$and":[{"status":"active"},{"$or":[{"role":"admin"},{"role":"owner"}]}]}

# 9. Only soft-deleted (trash)
GET /users?onlyDeleted=true

# 10. Count active users grouped by plan
GET /users/get/counts?filter={"status":"active"}&groupByKey=plan
```

## Query operators

Filters live under `where`. The shorthand `{ "field": value }` means equality;
the full form is `{ "field": { "$operator": value } }`.

```jsonc
// equality shorthand
{ "status": "active" }
// explicit operator
{ "age": { "$gte": 18 } }
// multiple operators on one field
{ "age": { "$gte": 18, "$lt": 65 } }
```

| Operator | Meaning | Example value |
| --- | --- | --- |
| `$eq` | equals (default) | `{ "status": { "$eq": "active" } }` |
| `$ne` | not equals | `{ "status": { "$ne": "active" } }` |
| `$ieq` | case-insensitive equals | `{ "name": { "$ieq": "john" } }` |
| `$gt` `$gte` | greater than / or equal | `{ "age": { "$gte": 18 } }` |
| `$lt` `$lte` | less than / or equal | `{ "age": { "$lt": 65 } }` |
| `$like` `$notLike` | SQL LIKE (case-sensitive) | `{ "name": { "$like": "%jo%" } }` |
| `$iLike` `$notIlike` | LIKE (case-insensitive) | `{ "name": { "$iLike": "%JO%" } }` |
| `$startsWith` `$endsWith` | prefix / suffix match | `{ "name": { "$startsWith": "Jo" } }` |
| `$iStartsWith` `$iEndsWith` | prefix / suffix (case-insensitive) | `{ "name": { "$iStartsWith": "jo" } }` |
| `$in` `$notIn` | in / not in a list | `{ "id": { "$in": ["a", "b"] } }` |
| `$inL` `$notinL` | case-insensitive in / not in | `{ "code": { "$inL": ["us", "uk"] } }` |
| `$between` `$notBetween` | range (2-element array) | `{ "age": { "$between": [18, 65] } }` |
| `$isNull` `$isNotNull` | null checks | `{ "deletedAt": { "$isNull": true } }` |
| `$isTrue` `$isFalse` | boolean checks | `{ "isActive": { "$isTrue": true } }` |
| `$contArr` `$intersectsArr` | Postgres array contains / overlaps | `{ "tags": { "$contArr": ["a"] } }` |
| `$exists` `$notExists` | relation has / has no related rows | `{ "posts": { "$exists": true } }` |

Combine conditions with `$and` / `$or` (they take an array of sub-conditions):

```jsonc
{
  "$or": [
    { "status": "active" },
    { "$and": [ { "role": "admin" }, { "age": { "$gte": 18 } } ] }
  ]
}
```

**Notes**
- Empty `$in: []` matches nothing; empty `$notIn: []` matches everything.
- `$between` requires exactly `[start, end]`.
- `$contArr` / `$intersectsArr` are PostgreSQL-only.
- `$exists` / `$notExists` apply to a **relation** name (not a column) and take a
  boolean: `{ "posts": { "$exists": true } }` keeps only rows with at least one
  related row. `$exists: false` is equivalent to `$notExists: true`.
- Filter **values** are always parameterised. Unknown filter **fields** are
  rejected with `400 Bad Request` (only real columns / relation paths are allowed).

## Custom operators

Operators are resolved through a registry, so you can add your own without forking
the library:

```ts
import { WhereOperatorRegistry } from '@ackplus/nest-crud';

WhereOperatorRegistry.register('$regex', ({ column, value, param }) => ({
  query: `${column} ~ :${param}`,
  params: { [param]: value },
}));
```

Now `where: { "name": { "$regex": "^A" } }` works. The handler receives the
already-resolved, quoted `column`, a unique `param` name, the raw `value`, and the
connection `dbType`. Remove one with `WhereOperatorRegistry.unregister('$regex')`.

## Relations

Join related entities with `relations`. Three forms are accepted:

```jsonc
// 1. array of names (simplest)
["posts", "profile"]

// 2. nested via dot notation (parents are joined automatically)
["posts.comments", "profile.addresses.country"]

// 3. object form — per-relation select / where / join type
{
  "posts": { "select": ["id", "title"], "where": { "status": "published" } },
  "profile": { "joinType": "inner" }
}
```

```bash
# simple joins
GET /users?relations=["posts","profile"]

# nested join (comments of each post)
GET /users?relations=["posts.comments"]

# only published posts, and only their id + title
GET /users?relations=[{"posts":{"select":["id","title"],"where":{"status":"published"}}}]

# inner-join the profile so users without a profile are excluded
GET /users?relations=[{"profile":{"joinType":"inner"}}]
```

You can also filter and sort on a relation column from the **top-level** `where` /
`order` using dot notation:

```bash
GET /users?relations=["profile"]&where={"profile.age":{"$gte":18}}&order={"profile.age":"DESC"}
```

- `joinType` defaults to `left` (rows are kept even with no related row). Use
  `inner` to drop rows that have no match.
- A relation-scoped `where` (inside the object form) filters the **joined rows**;
  a top-level `where` on a relation column filters the **root rows**.
- To check only *whether* a relation has rows (without joining them), use the
  [`$exists` / `$notExists`](#query-operators) operators.

## Select

Limit the returned columns with `select`. The primary key is always included
(so relations still hydrate), and [hidden fields](#hiding-sensitive-fields) are
silently dropped.

```bash
# top-level columns
GET /users?select=["id","email","firstName"]

# combine with a relation (profile is still fully returned)
GET /users?select=["id","name"]&relations=["profile"]

# limit relation columns too, via the object form
GET /users?select=["id","name"]&relations=[{"profile":{"select":["bio","age"]}}]
```

## Hiding sensitive fields

By default every real column and relation is queryable — including ones you may
not want clients to read (password hashes, tokens, internal flags, audit logs).
Mark them **hidden** and they become invisible to the whole query layer.

Two ways, which can be combined:

**1. On the entity, with `@CrudHidden()`** (recommended — applies everywhere the
entity is used):

```ts
import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity, CrudHidden } from '@ackplus/nest-crud';

@Entity()
export class User extends BaseEntity {
  @Column() email: string;

  @Column() @CrudHidden() passwordHash: string;          // hidden column

  @OneToMany(() => AuditLog, (a) => a.user)
  @CrudHidden() auditLogs: AuditLog[];                    // hidden relation
}
```

**2. Per controller, with `@Crud({ hiddenFields })`** (no entity change):

```ts
@Crud({ entity: User, hiddenFields: ['passwordHash'] })
export class UsersController {}
```

A hidden field is then:

| Used in… | Result |
| --- | --- |
| the response (default or explicit `select`) | **omitted** |
| `where`, `order`, `aggregates` `field` | **`400`** — rejected like an unknown field |
| `relations` (hidden relation) | **`400`** |
| a relation's hidden column (e.g. joined `profile.ssn`) | **omitted** from the join |

```bash
GET /users?select=["email","passwordHash"]   # passwordHash silently dropped
GET /users?where={"passwordHash":{"$eq":"x"}}  # 400 Bad Request
GET /users?relations=["auditLogs"]             # 400 Bad Request
```

Rejections use the same message as a genuinely unknown field, so a hidden field's
existence is never revealed. Hidden columns are never even read from the database.

> This guards the **generated CRUD query surface**. It is not a replacement for
> authorization — combine it with guards (see [auth-and-guards.md](./auth-and-guards.md))
> for who-can-access rules, and with `beforeFindMany` for row-level scoping.

## Order

Sort with `order` (a map of column → `ASC` | `DESC`):

```
GET /users?order={"createdAt":"DESC","firstName":"ASC"}
```

## Aggregates

Attach computed `count` / `sum` / `avg` / `min` / `max` values to each returned
row with `aggregates` — a list of
`{ fn, field, as }` specs. `field` is a relation-qualified path; `as` is the key
the value is returned under (and what `having` / `order` reference).

```
GET /users?aggregates=[{"fn":"count","field":"posts.id","as":"postCount"}]
```
```json
{ "items": [ { "id": "…", "name": "John", "postCount": 2 } ], "total": 1 }
```

| `fn` | Meaning | Empty relation |
| --- | --- | --- |
| `count` | number of related rows | `0` |
| `sum` | sum of a related column | `0` |
| `avg` | average of a related column | `null` |
| `min` `max` | min / max of a related column | `null` |

Each aggregate is a **correlated subquery**, so adding several aggregates — or
joining the same relation via `relations` — never inflates the numbers. Pass
`distinct: true` for `COUNT(DISTINCT …)`.

### Filtering an aggregate — per-aggregate `where`

Add a `where` to an aggregate spec to count/sum **only the related rows that
match** — using the **same operators as the top-level `where`**. The keys are
columns of the related entity:

```bash
# postCount = all posts; publishedCount = only published; bigSpenders = likes > 100
GET /users?aggregates=[
  {"fn":"count","field":"posts.id","as":"postCount"},
  {"fn":"count","field":"posts.id","as":"publishedCount","where":{"status":"published"}},
  {"fn":"sum","field":"posts.likes","as":"hotLikes","where":{"likes":{"$gt":100}}}
]
```

The filter is appended inside that aggregate's subquery
(`… WHERE posts.userId = user.id AND (posts.status = :p)`), so the aggregates stay
independent. Every operator works — `$gt`, `$in`, `$like`, `$between`, `$and` /
`$or`, etc. Unknown or hidden columns in an aggregate `where` are rejected with a
`400`.

Several aggregates at once, returned alongside the joined relation:

```bash
GET /users?relations=["posts"]&aggregates=[
  {"fn":"count","field":"posts.id","as":"postCount"},
  {"fn":"sum","field":"posts.likes","as":"totalLikes"},
  {"fn":"avg","field":"posts.likes","as":"avgLikes"},
  {"fn":"max","field":"posts.likes","as":"bestPost"}
]
```
```json
{
  "items": [
    { "id": "u1", "name": "John", "posts": [ /* … */ ],
      "postCount": 2, "totalLikes": 15, "avgLikes": 7.5, "bestPost": 10 }
  ],
  "total": 1
}
```

### Filtering on aggregates — `having`

`having` filters on aggregate aliases using the **same operators** as `where`. The
returned `total` reflects the filter and is independent of pagination:

```
GET /users?aggregates=[{"fn":"count","field":"posts.id","as":"postCount"}]&having={"postCount":{"$gt":5}}
```

### Sorting on aggregates

`order` can reference an aggregate alias (or any root column):

```
GET /users?aggregates=[{"fn":"sum","field":"posts.likes","as":"likesSum"}]&order={"likesSum":"DESC"}
```

**Notes**
- `field` must be relation-qualified (e.g. `posts.id`); `as` must be a safe
  identifier and cannot collide with an entity column.
- Aggregates are over single-level relations; many-to-many is not yet supported.
- In an aggregate query, `order` accepts aggregate aliases and root columns.
- With the client builder: `.addAggregate({...})`, `.having('postCount', '$gt', 5)`,
  `.addOrder('postCount', 'DESC')`.

## Client query builder

`@ackplus/nest-crud-request` builds these query strings for you with a fluent API —
no hand-written JSON.

```ts
import {
  QueryBuilder, WhereOperatorEnum, OrderDirectionEnum, AggregateFnEnum,
} from '@ackplus/nest-crud-request';

const qb = new QueryBuilder()
  .where('status', 'active')                        // shorthand equality
  .andWhere('age', WhereOperatorEnum.GT_OR_EQ, 18)  // explicit operator
  .addRelation('profile', ['bio'])                  // join + pick relation columns
  .addSelect(['id', 'name'])
  .addOrder('createdAt', OrderDirectionEnum.DESC)
  .setTake(20)
  .setSkip(0);

// → params for any HTTP client (axios, fetch, …)
await axios.get('/users', { params: qb.toObject() });
```

Aggregates with HAVING and order-by-alias:

```ts
const qb = new QueryBuilder()
  .addAggregate({ fn: AggregateFnEnum.COUNT, field: 'posts.id', as: 'postCount' })
  .having('postCount', WhereOperatorEnum.GT, 5)
  .addOrder('postCount', OrderDirectionEnum.DESC);

await axios.get('/users', { params: qb.toObject() });
```

- `where` / `having` accept `(field, value)`, `(field, operator, value)`, or a raw
  object; `orWhere` / `andHaving` / `orHaving` are also available.
- `.toObject()` returns params with JSON-string values (the default HTTP shape);
  `.toObject(true)` keeps nested objects; `.toJson()` returns one JSON string.

### Flutter / Dart

A Dart twin, **`nest_crud_request`** (in
[`clients/flutter`](https://github.com/ack-solutions/nest-crud/tree/main/clients/flutter/nest_crud_request)),
mirrors this builder and produces the same query strings — use it from Flutter:

```dart
final params = (QueryBuilder()
      ..where('status', 'active')
      ..whereOp('age', WhereOperator.gte, 18)
      ..addAggregate(fn: AggregateFn.count, field: 'posts.id', as: 'postCount')
      ..havingOp('postCount', WhereOperator.gt, 5)
      ..addOrder('createdAt', OrderDirection.desc)
      ..setTake(20))
    .toQueryParameters();

await dio.get('/users', queryParameters: params);
```

It's published to pub.dev at the same version as the JS packages.

## Pagination

`take` (page size) and `skip` (offset) control the window. `findMany` returns the
window plus the total count.

```
GET /users?take=20&skip=40
```
```json
{ "items": [ /* up to 20 users */ ], "total": 137 }
```

- `limit` / `offset` are accepted as aliases for `take` / `skip`.
- The server enforces `maxPerPage` (default 5000). A larger `take` returns `400`.
- `findAll` (`GET /resource/get/all`) returns a bare array with no pagination
  metadata, still capped by `maxPerPage`.

## Counts

`GET /resource/get/counts` returns the number of matching rows. Pass a `filter`
(same shape as `where`) and an optional `groupByKey`.

```
GET /users/get/counts?filter={"isActive":true}
```
```json
{ "total": 42 }
```
```
GET /users/get/counts?groupByKey=status
```
```json
{ "total": 100, "data": [ { "count": 60, "status": "active" }, { "count": 40, "status": "inactive" } ] }
```

## Soft delete

When the entity has a `deletedAt` column (it does via `BaseEntity`), deleted rows
are hidden from lists by default. Two flags change that:

- `withDeleted=true` — include soft-deleted rows alongside live ones.
- `onlyDeleted=true` — return only soft-deleted (trashed) rows.

```
GET /users?withDeleted=true
GET /users?onlyDeleted=true
```

See [soft-delete.md](./soft-delete.md) for the trash / restore routes.

## Bulk operations

- `POST /resource/bulk` — create many. Body: `{ "bulk": [ {…}, {…} ] }`.
- `PUT /resource/bulk` — update many. Body: `{ "bulk": [ { "id": "…", … } ] }`.
- `DELETE /resource/delete/bulk?ids=a&ids=b` — delete many by id (ids in the query).

## Reorder

For entities extending `BaseEntityWithOrder`, `PUT /resource/reorder` accepts an
ordered list of ids and writes their `order` field (0, 1, 2, …) in a transaction.
The body is `{ "ids": [...] }`.

```bash
curl -X PUT localhost:3000/items/reorder -H 'content-type: application/json' \
  -d '{"ids":["id-3","id-1","id-2"]}'
```

## Extending the service

`CrudService` exposes override points so you can customise behaviour in a subclass
rather than patching the library:

- `beforeFindMany` / `beforeFindOne` / `beforeCounts` — add `andWhere`, force joins,
  default ordering, tenant scoping. (Do **not** call `.select()` here.)
- `createFindQueryBuilder()` — swap or wrap the list query builder.
- `createAggregateQueryBuilder()` — customise the two-phase aggregate execution.

```ts
@Injectable()
export class UserService extends CrudService<User> {
  protected async beforeFindMany(qb) {
    return qb.andWhere(`${qb.alias}.tenantId = :tid`, { tid: currentTenant() });
  }
}
```

> `beforeFindMany` is not applied on the aggregate path — override
> `createAggregateQueryBuilder()` to customise that.
