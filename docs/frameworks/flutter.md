# Flutter / Dart

The Dart package **[`nest_crud_request`](https://pub.dev/packages/nest_crud_request)**
is the Flutter twin of the JS [`@ackplus/nest-crud-request`](https://www.npmjs.com/package/@ackplus/nest-crud-request).
It builds the **query parameters** a `@ackplus/nest-crud` server understands —
filters, relations, aggregates, ordering, pagination — and produces the **exact
same query strings** as the JS client. Talk to your existing API with no server
changes.

> New to this API? Read the [Querying guide](/querying) once for the concepts
> (operators, relations, aggregates). This page shows the Dart equivalent of each.

## Mental model

Your `@ackplus/nest-crud` server exposes REST routes (`GET /users`, `GET /users/:id`, …).
List endpoints accept query parameters where the complex ones (`where`, `relations`,
`order`, `select`, `aggregates`, `having`) are **JSON strings**.

`nest_crud_request` is **just a builder for those parameters** — it does not make
HTTP calls. You build a `QueryBuilder`, call `.toQueryParameters()`, and hand the
result to your HTTP client (`dio` or `http`). The flow:

```
QueryBuilder ── .toQueryParameters() ──▶ {where: '...', take: '20', ...} ──▶ dio.get('/users', queryParameters: ...)
                                                                                  │
                                                              server returns ◀────┘  { "items": [...], "total": 137 }
```

So there are exactly three things to learn: **build**, **send**, **parse**.

## Install

```yaml
# pubspec.yaml
dependencies:
  nest_crud_request: ^1.1.42
  dio: ^5.0.0   # any HTTP client works; dio is used in the examples
```

```bash
flutter pub get
```

```dart
import 'package:nest_crud_request/nest_crud_request.dart';
```

## Your first request

Fetch active adult users, newest first, first page of 20:

```dart
final qb = QueryBuilder()
  ..where('status', 'active')                 // filter
  ..whereOp('age', WhereOperator.gte, 18)     // filter with an operator
  ..addOrder('createdAt', OrderDirection.desc)
  ..setTake(20)
  ..setSkip(0);

final res = await dio.get('/users', queryParameters: qb.toQueryParameters());

// The server returns { items: [...], total: number }
final items = res.data['items'] as List;
final total = res.data['total'] as int;
```

That request is literally:

```
GET /users?where={"status":{"$eq":"active"},"$and":[{"age":{"$gte":18}}]}&order={"createdAt":"DESC"}&take=20&skip=0
```

Every method below shows the **Dart you write** and the **JSON it puts on the wire**,
so you always know exactly what your filter does.

---

## Filtering — `where`

`where` decides **which rows** come back. There are four ways to express a
condition, each available as `where` (first/AND), `andWhere` (AND), and `orWhere` (OR).

### 1. Equality — `where(field, value)`

```dart
qb.where('status', 'active');
// → where = {"status":{"$eq":"active"}}
```

### 2. Operator — `whereOp(field, operator, value)`

```dart
qb.whereOp('age', WhereOperator.gte, 18);
// → where = {"age":{"$gte":18}}
```

Stacking calls on the **same field** merges them (an implicit AND on that field):

```dart
qb..whereOp('age', WhereOperator.gte, 18)
  ..whereOp('age', WhereOperator.lt, 65);
// → where = {"age":{"$gte":18,"$lt":65}}   (18 ≤ age < 65)
```

### 3. Raw object — `whereRaw(map)`

When you'd rather write the JSON shape directly:

```dart
qb.whereRaw({'role': {r'$in': ['admin', 'editor']}});
// → where = {"role":{"$in":["admin","editor"]}}
```

> `r'$in'` is a Dart **raw string** — the `r` prefix stops Dart from treating `$`
> as string interpolation. Always write operator tokens as `r'$in'`, `r'$gt'`, etc.
> (or just use the `WhereOperator` enum, which avoids the issue entirely).

### 4. Group — `whereGroup((g) { ... })`

Builds a nested `(A OR B)` / `(A AND B)` group. **To get an OR group, use `orWhere`
inside it** (this is the #1 thing people get wrong):

```dart
qb.whereGroup((g) => g
  ..orWhere('role', 'admin')
  ..orWhere('role', 'owner'));
// → where = {"$or":[{"role":{"$eq":"admin"}},{"role":{"$eq":"owner"}}]}
```

### AND vs OR — what each call does

```dart
qb..where('status', 'active')      // base condition (top level)
  ..orWhere('role', 'admin')       // adds an $or group
  ..andWhere('verified', true);    // adds an $and group
// → where = {
//     "status":{"$eq":"active"},
//     "$or":[{"role":{"$eq":"admin"}}],
//     "$and":[{"verified":{"$eq":true}}]
//   }
// reads as: status=active AND (role=admin) AND (verified=true)
```

Rule of thumb: `where`/`andWhere` add **AND** conditions; `orWhere` adds **OR**
conditions; `whereGroup` wraps a set of them in one parenthesised group.

### Value-less and relation operators

Some operators don't compare to a value — pass `true`:

```dart
qb.whereOp('deletedAt', WhereOperator.isNull, true);     // {"deletedAt":{"$isNull":true}}
qb.whereOp('isActive', WhereOperator.isTrue, true);      // {"isActive":{"$isTrue":true}}
qb.whereOp('posts', WhereOperator.exists, true);         // {"posts":{"$exists":true}}  ← only users that HAVE posts
qb.whereOp('posts', WhereOperator.notExists, true);      // users with NO posts
```

`$exists` / `$notExists` take a **relation name** (not a column) and test only
*whether* related rows exist — they don't fetch them (use [relations](#relations-relations)
for that).

## Operator reference

Every operator, the Dart enum, the wire token, and what it does. (`field` below is
any column, or a relation path like `profile.age`.)

| Dart enum | Token | What it matches | Example → produces |
| --- | --- | --- | --- |
| `eq` | `$eq` | equals (the default) | `where('s','a')` → `{"s":{"$eq":"a"}}` |
| `ne` | `$ne` | not equal | `whereOp('s',WhereOperator.ne,'a')` |
| `ieq` | `$ieq` | case-insensitive equal | `name $ieq "john"` matches "John" |
| `gt` `gte` | `$gt` `$gte` | greater than / or equal | `age $gte 18` |
| `lt` `lte` | `$lt` `$lte` | less than / or equal | `age $lt 65` |
| `inList` | `$in` | value in a list | `role $in ["admin","user"]` |
| `notIn` | `$notIn` | value not in a list | |
| `inL` `notinL` | `$inL` `$notinL` | case-insensitive in / not in | `code $inL ["us","uk"]` |
| `like` `notLike` | `$like` `$notLike` | SQL `LIKE` (case-sensitive) | `name $like "%jo%"` |
| `iLike` `notIlike` | `$iLike` `$notIlike` | `LIKE` (case-insensitive) | `name $iLike "%JO%"` |
| `startsWith` `endsWith` | `$startsWith` `$endsWith` | prefix / suffix | `name $startsWith "Jo"` |
| `iStartsWith` `iEndsWith` | `$iStartsWith` `$iEndsWith` | prefix / suffix (case-insensitive) | |
| `between` `notBetween` | `$between` `$notBetween` | range `[start, end]` | `age $between [18,65]` |
| `isNull` `isNotNull` | `$isNull` `$isNotNull` | null checks (pass `true`) | |
| `isTrue` `isFalse` | `$isTrue` `$isFalse` | boolean checks (pass `true`) | |
| `contArr` `intersectsArr` | `$contArr` `$intersectsArr` | Postgres array contains / overlaps | `tags $contArr ["a"]` |
| `exists` `notExists` | `$exists` `$notExists` | relation has / has no rows (pass `true`) | `posts $exists true` |

> `$contArr` / `$intersectsArr` are PostgreSQL-only. Empty `$in: []` matches
> nothing; empty `$notIn: []` matches everything. `$between` needs exactly
> `[start, end]`. Unknown or [hidden](/querying#hiding-sensitive-fields) fields are
> rejected by the server with `400`.

---

## Relations — `addRelation`

Joins related entities so they come back nested on each row.

```dart
qb.addRelation('profile');                                  // → relations = {"profile":true}
qb.addRelation('posts', select: ['id', 'title']);           // pick which columns of the relation
// → {"posts":{"select":["id","title"]}}
qb.addRelation('posts', where: {'status': 'published'}, joinType: 'inner');
// → {"posts":{"where":{"status":"published"},"joinType":"inner"}}
```

- `select:` — only these columns of the related entity.
- `where:` — filter the **related rows**.
- `joinType:` — `'left'` (default, keeps rows with no related row) or `'inner'`
  (drops rows that have none).
- Nested relations use dot paths: `qb.addRelation('posts.comments')`.

Remove one with `qb.removeRelation('posts')`.

## Selecting columns — `addSelect`

Limit which **root** columns return. The primary key is always included so nested
relations still hydrate.

```dart
qb.addSelect(['id', 'name']);     // → select = ["id","name"]
qb.addSelect('email');            // add one more → ["id","name","email"]
qb.removeSelect('email');         // → ["id","name"]
```

## Ordering — `addOrder`

```dart
qb..addOrder('createdAt', OrderDirection.desc)
  ..addOrder('name', OrderDirection.asc);
// → order = {"createdAt":"DESC","name":"ASC"}   (sorts by createdAt desc, then name asc)
```

Order keys may be root columns, dotted relation columns (`profile.age`), or
[aggregate aliases](#aggregates-addaggregate). `qb.removeOrder('name')` drops one.

## Pagination — `setTake` / `setSkip`

```dart
qb..setTake(20)   // page size  → take = 20
  ..setSkip(40);  // offset     → skip = 40   (page 3 at size 20)
```

The list response is `{ items: [...], total: <count> }`, where `total` is the full
match count (ignores the page window), so you can compute page counts. The server
caps `take` at its `maxPerPage`.

## Soft-delete flags

```dart
qb.setWithDeleted(true);   // → withDeleted = true   (include soft-deleted rows)
qb.setOnlyDeleted(true);   // → onlyDeleted = true   (only soft-deleted / "trash")
```

## Aggregates — `addAggregate`

Attach a computed value (count / sum / avg / min / max over a relation) to **each
returned row**.

```dart
qb.addAggregate(fn: AggregateFn.count, field: 'posts.id', as: 'postCount');
// → aggregates = [{"fn":"count","field":"posts.id","as":"postCount"}]
// each user comes back with a `postCount` field.
```

- `fn:` — `count` / `sum` / `avg` / `min` / `max`.
- `field:` — relation-qualified path (e.g. `posts.id`, `posts.likes`).
- `as:` — the key the value is returned under, and what `having` / `addOrder` reference.
- `distinct: true` — for `COUNT(DISTINCT …)`.
- `where:` — count/sum **only the related rows that match** (same operators as `where`):

```dart
qb.addAggregate(
  fn: AggregateFn.count, field: 'posts.id', as: 'publishedCount',
  where: {'status': 'published'},
);
// → counts only each user's published posts
```

## Filtering aggregates — `having` / `havingOp`

`having` filters on aggregate **aliases**, using the same forms as `where`:

```dart
qb..addAggregate(fn: AggregateFn.count, field: 'posts.id', as: 'postCount')
  ..havingOp('postCount', WhereOperator.gt, 5)   // → having = {"postCount":{"$gt":5}}
  ..addOrder('postCount', OrderDirection.desc);
```

`having` (equality), `havingOp` (operator), `andHaving`, `orHaving`. The `total`
in the response reflects the `having` filter.

## Output methods

| Method | Returns | Use it for |
| --- | --- | --- |
| `toQueryParameters()` | `Map<String, String>` | **HTTP** — pass to `dio`/`http` query params (recommended) |
| `toObject()` | `Map<String, dynamic>` | params with complex fields **JSON-stringified** (the wire shape) |
| `toObject(nested: true)` | `Map<String, dynamic>` | complex fields kept as native maps/lists (for logging/storage) |
| `toJson()` | `String` | the whole query as one JSON string |

Empty sections are omitted. Add any custom param with `qb.set('search', 'alice')`.

---

## Sending the request

### With `dio`

```dart
final dio = Dio(BaseOptions(baseUrl: 'https://api.example.com'));

Future<(List<User>, int)> fetchUsers(QueryBuilder qb) async {
  final res = await dio.get('/users', queryParameters: qb.toQueryParameters());
  final items = (res.data['items'] as List)
      .map((j) => User.fromJson(j as Map<String, dynamic>))
      .toList();
  return (items, res.data['total'] as int);
}
```

### With `http`

```dart
import 'package:http/http.dart' as http;

final uri = Uri.https('api.example.com', '/users', qb.toQueryParameters());
final res = await http.get(uri);
final body = jsonDecode(res.body);          // { items, total }
```

### A tiny typed model

```dart
class User {
  final String id;
  final String name;
  final int? postCount;                       // populated when you add the aggregate
  User({required this.id, required this.name, this.postCount});

  factory User.fromJson(Map<String, dynamic> j) => User(
        id: j['id'] as String,
        name: j['name'] as String,
        postCount: (j['postCount'] as num?)?.toInt(),
      );
}
```

## Recipes

### Search box

```dart
QueryBuilder searchUsers(String term) => QueryBuilder()
  ..whereGroup((g) => g
    ..orWhereOp('firstName', WhereOperator.iLike, '%$term%')
    ..orWhereOp('lastName', WhereOperator.iLike, '%$term%')
    ..orWhereOp('email', WhereOperator.iLike, '%$term%'))
  ..addOrder('firstName', OrderDirection.asc)
  ..setTake(20);
```

### Infinite scroll / paged list

```dart
QueryBuilder page(int pageIndex, {int perPage = 20}) => QueryBuilder()
  ..where('isActive', WhereOperator.isTrue, true)
  ..addOrder('createdAt', OrderDirection.desc)
  ..setTake(perPage)
  ..setSkip(pageIndex * perPage);
// stop when (items collected) >= total from the response.
```

### "Top authors" (aggregate + having + sort)

```dart
final qb = QueryBuilder()
  ..addAggregate(fn: AggregateFn.count, field: 'posts.id', as: 'postCount')
  ..addAggregate(fn: AggregateFn.sum,   field: 'posts.likes', as: 'totalLikes')
  ..havingOp('postCount', WhereOperator.gte, 1)
  ..addOrder('postCount', OrderDirection.desc)
  ..setTake(10);
```

### Reuse + tweak a base query

```dart
final base = QueryBuilder()..where('tenantId', currentTenant);
// derive without mutating the original:
final activeOnly = QueryBuilder(base.toObject(nested: true))..where('status', 'active');
```

## How it maps to the server

The builder only produces parameters; the server (`@ackplus/nest-crud`) turns them
into SQL. A few behaviours worth knowing as a client:

- **`total`** is the full match count, independent of `take`/`skip` — use it for
  page counts. With `having`, it reflects the filtered count.
- **Aggregates never double-count** even if you also join the relation — they run as
  correlated subqueries.
- **Hidden fields**: the server may mark some columns/relations hidden
  ([docs](/querying#hiding-sensitive-fields)); using one in `where`/`select`/etc.
  returns `400` (treated like an unknown field).
- **Validation**: an unknown field/operator returns `400 Bad Request` — handle it
  in your `DioException` interceptor.

## Staying in sync with the JS client

The operator tokens and serialisation mirror `@ackplus/nest-crud-request` exactly
and are pinned by tests (`test/operators_test.dart`). Both clients are released
**together at the same version**, so a query built in Flutter behaves identically
to the same query built in your React/Angular/Vue app.

## Links

- Dart package: [pub.dev/packages/nest_crud_request](https://pub.dev/packages/nest_crud_request)
  · [source](https://github.com/ack-solutions/nest-crud/tree/main/clients/flutter/nest_crud_request)
- JS query builder: [@ackplus/nest-crud-request](https://www.npmjs.com/package/@ackplus/nest-crud-request)
- Server: [@ackplus/nest-crud](https://www.npmjs.com/package/@ackplus/nest-crud)
- Concepts: [Querying guide](/querying)
