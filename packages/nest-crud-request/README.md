# @ackplus/nest-crud-request

Framework-agnostic query builder for REST APIs that follow the `@ackplus/nest-crud` request format. Write filters, relations, select, order, and pagination with a fluent, type-safe API — no string gymnastics, no duplicated logic between frontend and backend.

Works in **React, Angular, Vue, Node.js**, and any TypeScript environment. Zero runtime dependencies beyond `tslib`.

---

## Table of contents

1. [Install](#install)
2. [Quick start](#quick-start)
3. [`QueryBuilder`](#querybuilder)
4. [`WhereBuilder`](#wherebuilder)
5. [Operators](#operators)
6. [Order and pagination](#order-and-pagination)
7. [Relations](#relations)
8. [Soft-delete flags](#soft-delete-flags)
9. [Output: `toObject()` vs `toObject(true)`](#output-toobject-vs-toobjecttrue)
10. [Custom keys (`set`)](#custom-keys-set)
11. [Recipes](#recipes)
12. [Types & enums reference](#types--enums-reference)
13. [Limits](#limits)

---

## Install

```bash
npm install @ackplus/nest-crud-request
```

No peer dependencies. Safe to use in browser bundles.

---

## Quick start

```ts
import {
  QueryBuilder,
  WhereOperatorEnum,
  OrderDirectionEnum,
} from '@ackplus/nest-crud-request';

const params = new QueryBuilder()
  .where('isActive', WhereOperatorEnum.EQ, true)
  .addRelation('posts', ['id', 'title'])
  .addOrder('createdAt', OrderDirectionEnum.DESC)
  .setTake(10)
  .setSkip(0)
  .toObject();

const query = new URLSearchParams(params as Record<string, string>).toString();
const res = await fetch(`/users?${query}`);
```

That produces:

```http
GET /users?where=%7B%22isActive%22%3A%7B%22%24eq%22%3Atrue%7D%7D
          &relations=%7B%22posts%22%3A%7B%22select%22%3A%5B%22id%22%2C%22title%22%5D%7D%7D
          &order=%7B%22createdAt%22%3A%22DESC%22%7D
          &take=10&skip=0
```

which is exactly what a `@ackplus/nest-crud` controller expects.

---

## `QueryBuilder`

The top-level builder. Every method returns `this`, so chain freely.

### Construction

```ts
new QueryBuilder();                        // empty
new QueryBuilder({ where: {...} });        // seed from options
```

### Select (root columns)

```ts
qb.addSelect('id');
qb.addSelect(['email', 'firstName']);
qb.removeSelect('firstName');
```

### Where

Four call shapes, all accepted by `where` / `andWhere` / `orWhere`:

```ts
// 1. field + value (EQ shorthand)
qb.where('status', 'active');

// 2. field + operator + value
qb.where('age', WhereOperatorEnum.GTE, 18);

// 3. raw object
qb.where({ role: { $in: ['admin', 'editor'] } });

// 4. nested callback — builds a grouped condition
qb.orWhere((b) => {
  b.where('role', 'admin');
  b.andWhere('verified', true);
});
```

- `where` / `andWhere` — combined with **AND**
- `orWhere` — combined with **OR**

### Relations

```ts
qb.addRelation('posts');
qb.addRelation('posts', ['id', 'title']);
qb.addRelation('posts', ['id', 'title'], { published: { $eq: true } });
qb.removeRelation('posts');
```

Need `joinType: 'inner'` or deeper relation config? Use [`set()`](#custom-keys-set) — the fluent API only covers the common shape.

### Order

```ts
qb.addOrder('createdAt', OrderDirectionEnum.DESC);
qb.addOrder('email', OrderDirectionEnum.ASC);
qb.removeOrder('email');
```

### Pagination

```ts
qb.setTake(20);
qb.setSkip(40);
```

No `setPage` / `setPerPage` helpers — compute them yourself: `skip = (page - 1) * perPage`.

### Soft-delete

```ts
qb.setWithDeleted(true);  // include deleted rows
qb.setOnlyDeleted(true);  // only deleted rows
```

### Options merging

```ts
qb.setOptions({ where: {...}, take: 50 });      // replace everything
qb.mergeOptions({ where: {...} });              // shallow merge (default)
qb.mergeOptions({ where: {...} }, true);        // deep merge
```

### Output

```ts
qb.toObject();       // default — where/relations/select/order JSON-stringified
qb.toObject(true);   // nested — everything stays as native objects
qb.toJson();         // JSON string of the nested form (equivalent to JSON.stringify(toObject(true)))
```

See [Output](#output-toobject-vs-toobjecttrue).

---

## `WhereBuilder`

`WhereBuilder` builds a `where` object on its own — handy if you want to compose filter logic separately from the full query.

```ts
import { WhereBuilder, WhereOperatorEnum } from '@ackplus/nest-crud-request';

const where = new WhereBuilder()
  .where('age', WhereOperatorEnum.GT, 18)
  .orWhere((b) => {
    b.where('role', 'admin');
    b.andWhere('department', 'IT');
  })
  .toObject();

// { $or: [ { age: { $gt: 18 } }, { role: { $eq: 'admin' }, department: { $eq: 'IT' } } ] }
```

### Methods

| Method | Purpose |
| --- | --- |
| `where(...)` / `andWhere(...)` / `orWhere(...)` | Same four call shapes as `QueryBuilder.where` |
| `removeWhere(field)` | Drop a field from the current conditions |
| `clear()` | Reset to empty |
| `hasConditions()` | `true` if anything has been added |
| `toObject()` | Raw where object (never stringified) |
| `toJson()` | `JSON.stringify(toObject())` |

Feed the result into a `QueryBuilder`:

```ts
qb.setOptions({ where: where.toObject() });
// or
qb.where(where.toObject());
```

`WhereBuilder` is usable entirely standalone; you don't need a `QueryBuilder` at all.

---

## Operators

Import them from the enum or pass the raw `$...` string — both work.

| Enum | Value | Meaning |
| --- | --- | --- |
| `EQ` | `$eq` | Equal (default when you pass a scalar without an operator) |
| `NOT_EQ` | `$ne` | Not equal |
| `GT` / `GT_OR_EQ` | `$gt` / `$gte` | Greater than / or equal |
| `LT` / `LT_OR_EQ` | `$lt` / `$lte` | Less than / or equal |
| `IN` / `NOT_IN` | `$in` / `$notIn` | In / not in array |
| `LIKE` / `NOT_LIKE` | `$like` / `$notLike` | SQL `LIKE` / `NOT LIKE` |
| `ILIKE` / `NOT_ILIKE` | `$iLike` / `$notIlike` | Case-insensitive `LIKE` / `NOT LIKE` |
| `STARTS_WITH` / `ENDS_WITH` | `$startsWith` / `$endsWith` | Prefix / suffix |
| `ISTARTS_WITH` / `IENDS_WITH` | `$iStartsWith` / `$iEndsWith` | Case-insensitive prefix / suffix |
| `IN_L` / `NOT_IN_L` | `$inL` / `$notinL` | Case-insensitive `IN` / `NOT IN` |
| `CONT_ARR` | `$contArr` | Postgres array contains (`@>`) |
| `INTERSECTS_ARR` | `$intersectsArr` | Postgres array intersects (`&&`) |
| `IS_NULL` / `IS_NOT_NULL` | `$isNull` / `$isNotNull` | `IS NULL` / `IS NOT NULL` (no value) |
| `BETWEEN` / `NOT_BETWEEN` | `$between` / `$notBetween` | Range `[start, end]` |
| `IS_TRUE` / `IS_FALSE` | `$isTrue` / `$isFalse` | Boolean truthiness |

Logical operators (`WhereLogicalOperatorEnum`): `AND` (`$and`), `OR` (`$or`).

---

## Order and pagination

```ts
new QueryBuilder()
  .addOrder('createdAt', OrderDirectionEnum.DESC)
  .addOrder('name', OrderDirectionEnum.ASC)
  .setTake(20)
  .setSkip(40)
  .toObject();

// { order: '{"createdAt":"DESC","name":"ASC"}', take: 20, skip: 40 }
```

---

## Relations

```ts
new QueryBuilder()
  .addRelation('posts', ['id', 'title'], { published: { $eq: true } })
  .addRelation('profile')
  .toObject(true);

// {
//   relations: {
//     posts: { select: ['id', 'title'], where: { published: { $eq: true } } },
//     profile: true,
//   }
// }
```

Need `joinType`? The builder doesn't have a dedicated helper, so use `set`:

```ts
qb.set('relations', {
  posts: { select: ['id', 'title'], joinType: 'inner' },
});
```

---

## Soft-delete flags

```ts
qb.setWithDeleted(true);   // ?withDeleted=true
qb.setOnlyDeleted(true);   // ?onlyDeleted=true
```

Both flags are forwarded as-is. The server decides how to interpret them (see `@ackplus/nest-crud`).

---

## Output: `toObject()` vs `toObject(true)`

`toObject()` is designed to be dropped straight into `URLSearchParams` or `axios({ params })`. It **JSON-stringifies** the complex fields (`where`, `relations`, `select`, `order`) because they don't serialize cleanly otherwise.

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

`toObject(true)` (or `toJson()`) keeps everything as native values — useful for logging, diffing, storing in URL state, or passing directly to a backend Node client.

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

Empty sections are dropped from both forms.

---

## Custom keys (`set`)

Anything not in the standard schema goes through `set`:

```ts
qb.set('search', 'alice');
qb.set('tenantId', 'acme');
qb.set('relations', { posts: { joinType: 'inner' } });
```

`set` is both an extensibility hook and an escape hatch for the less-common relation / where shapes.

---

## Recipes

### Pagination

```ts
function buildPage(page: number, perPage: number) {
  return new QueryBuilder()
    .setTake(perPage)
    .setSkip((page - 1) * perPage);
}
```

### Full-text-ish search

```ts
function buildSearch(term: string) {
  return new QueryBuilder().where((b) => {
    b.where('firstName', WhereOperatorEnum.ILIKE, `%${term}%`);
    b.orWhere('lastName', WhereOperatorEnum.ILIKE, `%${term}%`);
    b.orWhere('email', WhereOperatorEnum.ILIKE, `%${term}%`);
  });
}
```

### Axios client

```ts
import axios from 'axios';

async function listUsers(qb: QueryBuilder) {
  const { data } = await axios.get('/users', { params: qb.toObject() });
  return data; // { items, total }
}
```

### Deserializing back into a `QueryBuilder`

```ts
const stored = qb.toObject(true); // native shape
const restored = new QueryBuilder(stored);
```

---

## Types & enums reference

Everything below is exported from the package root.

### Public exports

- **Classes:** `QueryBuilder`, `WhereBuilder`
- **Enums:** `WhereOperatorEnum`, `WhereLogicalOperatorEnum`, `OrderDirectionEnum`
- **Types:** `QueryBuilderOptions`, `WhereObject`, `WhereOptions`, `RelationObject`, `RelationObjectValue`, `RelationOptions`, `FindManyResponse<T>`, `FindAllResponse<T>`, `WhereBuilderCondition`

`RelationBuilder` exists in the source but is **not** exported — use `QueryBuilder.addRelation()` or `set('relations', ...)` instead.

### Shapes

```ts
interface QueryBuilderOptions {
  select?: string[] | string;
  relations?: RelationOptions | string;
  where?: WhereOptions | string;
  order?: Record<string, OrderDirectionEnum> | string;
  skip?: number;
  take?: number;
  withDeleted?: boolean;
  onlyDeleted?: boolean;
  [extra: string]: any;
}

type RelationObjectValue = {
  select?: string[];
  where?: WhereObject | WhereObject[];
  joinType?: 'left' | 'inner';
};

type RelationObject = Record<string, RelationObjectValue | boolean>;
type RelationOptions = string | string[] | RelationObject;

type WhereObject = {
  [key: string]: any;
  $and?: WhereObject | WhereObject[];
  $or?: WhereObject | WhereObject[];
};
type WhereOptions = WhereObject | WhereObject[];

type WhereBuilderCondition =
  | [string, any]                               // field, value  -> $eq
  | [string, WhereOperatorEnum, any]            // field, op, value
  | [Record<string, any>]                       // raw object
  | [(builder: WhereBuilder) => void];          // nested callback
```

---

## Limits

- No `setPage` / `setPerPage` helpers (compute `skip` manually).
- No `setJoinType` helper — use `set('relations', ...)` for non-default join types.
- No built-in query-string serializer — pipe `toObject()` through `URLSearchParams`, `qs`, or your HTTP client's `params` option.
- Doesn't validate server-side operators — you can build filters the server rejects if you mix operators and column types carelessly.

For the matching backend, see [`@ackplus/nest-crud`](../nest-crud/README.md).

---

## License

MIT © Ackplus
