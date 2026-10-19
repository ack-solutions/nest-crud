---
name: nest-crud-request
description: Use when frontend or client TypeScript/JavaScript code (React, Angular, Vue, Node) calls an API built with @ackplus/nest-crud — building list filters, search, sorting, paging, relations, counts, aggregates or trash views with @ackplus/nest-crud-request's QueryBuilder, calling the bulk routes, or debugging a filter that is ignored or a 400 from a list endpoint.
---

# @ackplus/nest-crud-request

Builds the **query parameters** a nest-crud API understands. It does not make HTTP
calls — pass its output to your own client (fetch, axios, HttpClient, React Query).
Never hand-write the JSON query strings.

Full docs: https://ack-solutions.github.io/nest-crud/querying

## Build a query

```ts
import { QueryBuilder, WhereOperatorEnum as Op, OrderDirectionEnum } from '@ackplus/nest-crud-request';

const qb = new QueryBuilder()
  .where('status', Op.IN, ['open', 'held'])          // field, operator, value
  .andWhere('isActive', true)                        // field, value  → equals
  .andWhere((w) => w.where('name', Op.ILIKE, `%${term}%`).orWhere('sku', term))  // grouped OR
  .addRelation('author', ['id', 'name'])             // load a relation, only these columns
  .addOrder('createdAt', OrderDirectionEnum.DESC)
  .setTake(20)
  .setSkip(page * 20);

const params = qb.toObject();      // flat object; values are already JSON strings
await api.get('/notes', { params });                 // → { items, total }
```

- `where(...)` also takes an object: `.where({ status: 'open', age: { $gte: 18 } })`.
- `where`, `andWhere`, `orWhere` combine; a callback makes a bracketed group.
- Edit a query in place: `removeSelect`, `removeRelation`, `removeOrder`,
  `removeAggregate`; seed one with `new QueryBuilder(options)`.

## Operators (`WhereOperatorEnum`)

| Kind | Operators |
| --- | --- |
| Compare | `EQ` `NOT_EQ` `GT` `GT_OR_EQ` `LT` `LT_OR_EQ` `BETWEEN` `NOT_BETWEEN` |
| Lists | `IN` `NOT_IN` · case-insensitive: `IN_L` `NOT_IN_L` |
| Text | `LIKE` `NOT_LIKE` `STARTS_WITH` `ENDS_WITH` · case-insensitive: `IEQ` `ILIKE` `NOT_ILIKE` `ISTARTS_WITH` `IENDS_WITH` |
| Null / boolean | `IS_NULL` `IS_NOT_NULL` `IS_TRUE` `IS_FALSE` (value `true`) |
| Relation has rows | `EXISTS` `NOT_EXISTS` on a relation name |
| Postgres arrays | `CONT_ARR` `INTERSECTS_ARR` |

`LIKE`/`ILIKE` need your own `%` wildcards; `BETWEEN` takes `[from, to]`; `IN` takes an array.
Filter or sort on a related column with a dotted path, with that relation added:
`.addRelation('profile').where('profile.age', Op.GT_OR_EQ, 18)`.

## Which route for which screen

| Screen need | Call |
| --- | --- |
| Table with paging | `GET /notes` + `params` → `{ items, total }` |
| Dropdown / export (all matches, no paging) | `GET /notes/get/all` + `params` → array |
| Tab or badge counts | `GET /notes/get/counts` with `filter` (below) |
| Amounts per status (summary cards) | counts with `sum` (below) |
| One record with related data | `GET /notes/:id` + `{ relations }` |
| Per-row totals ("posts per user") | `addAggregate` on the list call |

Don't fetch a page of rows just to count them, and don't ask the backend for a new
endpoint for these.

## Counts — the query goes inside `filter`

```ts
const filter = new QueryBuilder().where('priority', 'high').toJson();   // toJson, not toObject
const { total, data } = await api.get('/notes/get/counts', {
  params: { filter, groupByKey: 'status' },         // data: [{ status, count }]
});
```

Add `sum: 'total'` (or an array) to also get amounts: each group row gains `total`,
and the reply gets overall `sum: { total }`.

`where`, `onlyDeleted` etc. sent as **root** params on the counts route are ignored
or rejected. `take`/`skip` don't apply to counts.

## Aggregates

```ts
new QueryBuilder()
  .addAggregate({ fn: 'count', field: 'posts.id', as: 'postCount' })   // count|sum|avg|min|max
  .having('postCount', Op.GT, 0)
  .addOrder('postCount', OrderDirectionEnum.DESC);
// each item gets `postCount`; `field` must be `relation.column`
// sorting such a list by a many-to-one column also works: .addOrder('category.name', …)
```

## Trash (soft delete)

`.setOnlyDeleted(true)` (only trashed) or `.setWithDeleted(true)` (both) — on list
calls, and inside the counts `filter`. The API may refuse these for some users and
return live rows only; don't treat that as an error.

Restore: `PUT /notes/:id/restore`. Delete forever: `DELETE /notes/:id/trash`.

## Bulk calls

| Action | Request |
| --- | --- |
| Create many | `POST /notes/bulk` `{ bulk: [...] }` |
| Update many | `PUT /notes/bulk` `{ bulk: [{ id, ...changes }] }` |
| Delete many | `DELETE /notes/delete/bulk?ids=a&ids=b` (one id is fine) |
| Restore many | `PUT /notes/restore/bulk` `{ ids: [...] }` |
| Reorder | `PUT /notes/reorder` `{ ids: [...] }` in the new order |

- **Update-many returns only the rows it changed.** A row that is missing, has a bad
  id, or isn't yours is skipped silently — compare the ids returned with the ids
  sent and tell the user about the difference.
- The API may cap bulk size (`400 … exceeds maxBulkSize`); send in chunks.
- Don't send `id`, `createdAt`, `updatedAt` or `deletedAt` when creating — the server
  drops them. To update, the id goes in the URL (or in each bulk item).

## Very long queries

If a filter can outgrow the URL (hundreds of ids in an `IN`), send it as a POST the
server treats as a GET — only if the API enabled method override:

```ts
await api.post('/notes', qb.toObject(), { headers: { 'X-HTTP-Method-Override': 'GET' } });
```

## Common mistakes

| Symptom | Cause |
| --- | --- |
| Counts ignore the filter | Sent `where` as a root param, or `toObject()`; use `filter: qb.toJson()` |
| `400` unknown field | Filtering/sorting on a column or relation the API doesn't expose (or hides) |
| `400` on `IN` / `BETWEEN` | Value isn't an array / a `[from, to]` pair |
| Search matches nothing | `LIKE` without `%`, or case-sensitive `LIKE` where `ILIKE` was meant |
| Related data missing | Forgot `addRelation`; relations are never loaded by default |
| `400` page size | `take` above the API's maximum; page instead |
| Bulk update "succeeds" but rows unchanged | Skipped rows — check the returned ids |

## If the API or this package looks wrong

Don't work around it silently in the UI. Check the installed version against the
changelog (https://github.com/ack-solutions/nest-crud/blob/main/CHANGELOG.md), then
draft an issue for https://github.com/ack-solutions/nest-crud/issues/new/choose with
the builder code, the exact request sent, and expected vs actual response. Show the
draft to the user and file it only if they agree; never include tokens or customer data.
