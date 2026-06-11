# Querying

All list endpoints (`findMany`, `findAll`, `counts`) accept the same query
parameters. Each can be sent as a **JSON string** (recommended) or as bracket /
dot notation. The client builder [`@ackplus/nest-crud-request`](https://github.com/ack-solutions/nest-crud/tree/main/packages/nest-crud-request)
produces exactly this format.

```
GET /users?where={"isActive":true}&relations=["posts"]&order={"createdAt":"DESC"}&take=20&skip=0
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

Join related entities with `relations` (array, object, or JSON string). Nested
relations use dot notation.

```
GET /users?relations=["posts","profile"]
GET /users?relations=["posts.comments"]
```

You can filter and sort on relation columns using the same dot notation:

```
GET /users?relations=["profile"]&where={"profile.age":{"$gte":18}}
```

## Select

Limit the returned columns with `select`:

```
GET /users?select=["id","email","firstName"]
```

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
ordered array of ids and writes their `order` field (0, 1, 2, …) in a transaction.

```bash
curl -X PUT localhost:3000/items/reorder -H 'content-type: application/json' \
  -d '["id-3","id-1","id-2"]'
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
