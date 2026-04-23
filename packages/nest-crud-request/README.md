# @ackplus/nest-crud-request

`@ackplus/nest-crud-request` builds query params that match the request format used by `@ackplus/nest-crud`.

Use it in:

- React
- Angular
- Vue
- Node.js
- shared TypeScript utility layers

## Installation

```bash
npm install @ackplus/nest-crud-request
```

## Quick Start

```ts
import { QueryBuilder, WhereOperatorEnum, OrderDirectionEnum } from '@ackplus/nest-crud-request';

const params = new QueryBuilder()
  .where('isActive', WhereOperatorEnum.EQ, true)
  .addRelation('posts', ['id', 'title'])
  .addOrder('createdAt', OrderDirectionEnum.DESC)
  .setTake(10)
  .setSkip(0)
  .toObject();

const query = new URLSearchParams(params).toString();
const response = await fetch(`/users?${query}`);
```

## What It Builds

Top-level keys:

- `where`
- `relations`
- `select`
- `order`
- `skip`
- `take`
- `withDeleted`
- `onlyDeleted`

By default, `toObject()` serializes `where`, `relations`, `select`, and `order` as JSON strings. That output is designed to work directly with the backend package.

## `QueryBuilder`

Main methods:

| Method | Purpose |
| --- | --- |
| `setOptions(options)` | replace all options |
| `mergeOptions(options, deep?)` | merge options |
| `addSelect(fields)` / `removeSelect(fields)` | manage root `select` |
| `addRelation(relation, select?, where?)` / `removeRelation(relation)` | manage `relations` |
| `where(...)` / `andWhere(...)` / `orWhere(...)` | build `where` |
| `addOrder(field, direction)` / `removeOrder(field)` | manage `order` |
| `setSkip(skip)` / `setTake(take)` | pagination |
| `setWithDeleted(value)` / `setOnlyDeleted(value)` | soft-delete flags |
| `set(key, value)` | add custom top-level fields |
| `toObject(constrainToNestedObject?)` | get request object |
| `toJson()` | JSON string of nested object form |

Example:

```ts
const params = new QueryBuilder()
  .where((builder) => {
    builder.where('status', 'active');
    builder.orWhere('role', WhereOperatorEnum.IN, ['admin', 'moderator']);
  })
  .addRelation('posts', ['id', 'title'], {
    published: { $eq: true },
  })
  .addSelect(['id', 'email'])
  .addOrder('createdAt', OrderDirectionEnum.DESC)
  .setTake(20)
  .toObject();
```

## `WhereBuilder`

`WhereBuilder` is exported if you want to build filters separately from the full query.

```ts
import { WhereBuilder, WhereOperatorEnum } from '@ackplus/nest-crud-request';

const where = new WhereBuilder()
  .where('age', WhereOperatorEnum.GT, 18)
  .orWhere((builder) => {
    builder.where('role', 'admin');
    builder.where('department', 'IT');
  })
  .toObject();
```

## Supported Operators

| Operator | Meaning |
| --- | --- |
| `$eq` | equal |
| `$ne` | not equal |
| `$gt` | greater than |
| `$gte` | greater than or equal |
| `$lt` | less than |
| `$lte` | less than or equal |
| `$in` | in array |
| `$notIn` | not in array |
| `$like` | like |
| `$notLike` | not like |
| `$iLike` | case-insensitive like |
| `$notIlike` | case-insensitive not like |
| `$startsWith` | starts with |
| `$endsWith` | ends with |
| `$iStartsWith` | case-insensitive starts with |
| `$iEndsWith` | case-insensitive ends with |
| `$inL` | case-insensitive in |
| `$notinL` | case-insensitive not in |
| `$contArr` | postgres array contains |
| `$intersectsArr` | postgres array intersects |
| `$isNull` | is null |
| `$isNotNull` | is not null |
| `$between` | between |
| `$notBetween` | not between |
| `$isTrue` | is true |
| `$isFalse` | is false |
| `$and` | logical and |
| `$or` | logical or |

## Output Examples

Nested object form:

```ts
new QueryBuilder()
  .where('isActive', true)
  .addOrder('createdAt', OrderDirectionEnum.DESC)
  .toObject(true);

// {
//   where: { isActive: { $eq: true } },
//   order: { createdAt: 'DESC' }
// }
```

Default request form:

```ts
new QueryBuilder()
  .where('isActive', true)
  .addOrder('createdAt', OrderDirectionEnum.DESC)
  .toObject();

// {
//   where: '{"isActive":{"$eq":true}}',
//   order: '{"createdAt":"DESC"}'
// }
```

## Known Limits

Current package behavior is intentionally small:

- there is no dedicated helper for relation `joinType`
- there is no dedicated helper for the backend `counts` route shape
- custom query serialization beyond the standard keys is your responsibility when you use `set(...)`

For the backend interpretation of these params, see [`../nest-crud/README.md`](../nest-crud/README.md).
