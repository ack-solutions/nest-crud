# nest_crud_request (Dart / Flutter)

Framework-agnostic **query builder** for [`@ackplus/nest-crud`](https://github.com/ack-solutions/nest-crud)
REST APIs — the Dart twin of the JS [`@ackplus/nest-crud-request`](https://www.npmjs.com/package/@ackplus/nest-crud-request).
Build filters, relations, aggregates, ordering and pagination with a fluent API,
then drop the result straight into `dio` / `http`. It produces the **exact same
query strings** as the JS client, so it talks to your existing API with **no server
changes**. Pure Dart, zero runtime dependencies.

> This package builds the request **query parameters** only (mirroring the JS
> request builder). It does not wrap HTTP — use any client you like.

## Install

```yaml
dependencies:
  nest_crud_request: ^1.1.42
```

## Quick start

```dart
import 'package:nest_crud_request/nest_crud_request.dart';

final params = (QueryBuilder()
      ..where('status', 'active')                                   // equality
      ..whereOp('age', WhereOperator.gte, 18)                       // operator
      ..addRelation('posts', select: ['id', 'title'])               // join + columns
      ..addOrder('createdAt', OrderDirection.desc)
      ..setTake(20)
      ..setSkip(0))
    .toQueryParameters();                                            // Map<String,String>

// with dio:
final res = await dio.get('/users', queryParameters: params);
// → GET /users?where={"status":{"$eq":"active"},...}&take=20&skip=0
```

## Where conditions

Four forms, each available as `where` / `andWhere` / `orWhere`:

```dart
qb.where('status', 'active');                          // field = value
qb.whereOp('age', WhereOperator.gte, 18);              // field, operator, value
qb.whereRaw({'role': {r'$in': ['admin', 'editor']}});  // raw object
qb.whereGroup((g) => g                                  // nested group: (a OR b)
    ..orWhere('role', 'admin')
    ..orWhere('role', 'owner'));
```

- `where` / `andWhere` combine with **AND**; `orWhere` with **OR**.
- Value-less operators: `qb.whereOp('deletedAt', WhereOperator.isNull, true)`.
- Relation existence: `qb.whereOp('posts', WhereOperator.exists, true)`.

## Operators

| Dart | Token | Meaning |
| --- | --- | --- |
| `eq` `ne` `ieq` | `$eq` `$ne` `$ieq` | equal / not equal / case-insensitive equal |
| `gt` `gte` `lt` `lte` | `$gt` `$gte` `$lt` `$lte` | comparison |
| `inList` `notIn` | `$in` `$notIn` | in / not in a list |
| `inL` `notinL` | `$inL` `$notinL` | case-insensitive in / not in |
| `like` `notLike` `iLike` `notIlike` | `$like` … | SQL LIKE (and case-insensitive) |
| `startsWith` `endsWith` `iStartsWith` `iEndsWith` | `$startsWith` … | prefix / suffix |
| `between` `notBetween` | `$between` `$notBetween` | range `[start, end]` |
| `isNull` `isNotNull` | `$isNull` `$isNotNull` | null checks |
| `isTrue` `isFalse` | `$isTrue` `$isFalse` | boolean checks |
| `contArr` `intersectsArr` | `$contArr` `$intersectsArr` | Postgres array contains / overlaps |
| `exists` `notExists` | `$exists` `$notExists` | relation has / has no rows |

Logical grouping: `WhereLogicalOperator.and` / `.or`.

## Relations

```dart
qb.addRelation('profile');                                            // join, all columns
qb.addRelation('posts', select: ['id', 'title']);                     // pick columns
qb.addRelation('posts', where: {'status': 'published'}, joinType: 'inner');
```

## Order, pagination, soft-delete

```dart
qb..addOrder('createdAt', OrderDirection.desc)
  ..addOrder('name', OrderDirection.asc)
  ..setTake(20)..setSkip(40)
  ..setWithDeleted(true)   // include soft-deleted
  ..setOnlyDeleted(true);  // only soft-deleted
```

## Aggregates & HAVING

Per-row aggregates over a relation, filtered and sorted by the alias:

```dart
qb..addAggregate(fn: AggregateFn.count, field: 'posts.id', as: 'postCount')
  ..addAggregate(fn: AggregateFn.sum,   field: 'posts.likes', as: 'totalLikes',
                 where: {'status': 'published'})   // per-aggregate filter
  ..havingOp('postCount', WhereOperator.gt, 5)
  ..addOrder('postCount', OrderDirection.desc);
```

## Output

```dart
qb.toQueryParameters(); // Map<String,String> — HTTP query params (recommended)
qb.toObject();          // Map<String,dynamic> — complex fields JSON-stringified
qb.toObject(nested: true); // keep complex fields as native maps/lists
qb.toJson();            // one JSON string of the nested form
```

Empty sections are omitted. Custom keys: `qb.set('search', 'alice')`.

## Keeping in sync with the JS client

The operator tokens and serialization mirror `@ackplus/nest-crud-request` exactly
and are pinned by `test/operators_test.dart`. Both clients are released together at
the same version, so a query built in Flutter behaves identically to one built in JS.

## License

MIT © Ackplus
