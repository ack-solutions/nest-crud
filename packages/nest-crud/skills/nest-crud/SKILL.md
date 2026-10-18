---
name: nest-crud
description: Use when working in a NestJS + TypeORM project that depends on @ackplus/nest-crud (or its client query builders @ackplus/nest-crud-request / nest_crud_request) — adding a CRUD resource, building list filters, counts or aggregates, tenant scoping, soft delete, custom or overridden routes, write hooks, bulk routes, or diagnosing a 400/404 from a generated endpoint.
---

# @ackplus/nest-crud

`@Crud()` on a controller generates the REST routes; a `CrudService<T>` subclass holds
the behaviour. You extend both in the app — never edit or patch the package.

Full docs: https://ack-solutions.github.io/nest-crud/ · changelog:
https://github.com/ack-solutions/nest-crud/blob/main/CHANGELOG.md

## Add a resource

```ts
@Entity('notes')
export class Note extends BaseEntity {          // id (uuid), createdAt, updatedAt, deletedAt
  @Column() title: string;
}

@Injectable()
export class NoteService extends CrudService<Note> {
  constructor(@InjectRepository(Note) public repository: Repository<Note>) { super(repository); }
}

@Crud({ entity: Note, path: 'notes', softDelete: true })   // also registers the controller path
export class NoteController {
  constructor(public service: NoteService) {}   // the property must be named `service`
}
```

Routes: `GET /` (page: `{ items, total }`), `GET /get/all`, `GET /get/counts`,
`GET /:id`, `POST /`, `POST /bulk`, `PUT /:id`, `PUT /bulk`, `DELETE /:id`,
`DELETE /delete/bulk?ids=`, `PUT /reorder`; with `softDelete: true` also
`PUT /:id/restore`, `PUT /restore/bulk`, `DELETE /:id/trash`, `DELETE /trash/bulk?ids=`.
Disable one with `routes: { reorder: false }`.

## Use the generated API before writing a new endpoint

Most "new endpoint" requests are already covered. Reach for a custom route only when
none of these fit:

| Need | Already there |
| --- | --- |
| Search / filter / sort / paginate a list | `GET /` with `where`, `order`, `take`, `skip` |
| Dropdown or export of all matching rows | `GET /get/all` (same filters, no paging) |
| Badge or tab counts, counts per status | `GET /get/counts?filter=…&groupByKey=status` |
| "Number of posts per user" on each row | `aggregates` (+ `having`, order by the alias) |
| Load related data | `relations` (no extra "with-details" endpoint) |
| Trash view / count | `filter` or query with `onlyDeleted: true` |
| Save or delete many rows | `POST /bulk`, `PUT /bulk`, `DELETE /delete/bulk?ids=` |
| Drag-and-drop ordering | `PUT /reorder` |
| Different logic on a standard route | override the service method or hook, keep the route |

## Querying

Query params are JSON strings: `where`, `relations`, `order`, `select`, `aggregates`,
`having`, plus `take`/`skip`, `withDeleted`, `onlyDeleted`. Client code should build
them with `QueryBuilder` from `@ackplus/nest-crud-request` — that package ships its
own skill (`npx @ackplus/nest-crud-request add-skill`).

- **Counts** take the whole query inside `filter`, not as root params:
  `GET /notes/get/counts?filter={"where":{…},"onlyDeleted":true}&groupByKey=status`.
- **Aggregates** need a relation path: `{ fn: 'count', field: 'posts.id', as: 'postCount' }`.
  An aggregate list can still sort by a to-one relation column (`order: {"category.name":"ASC"}`).
- An unknown or hidden field in `where`/`order`/`relations` is a `400`, by design.
- Query too long for a URL: `CrudMethodOverrideModule.forRoot()` (see "Large queries" in the docs).

## Tenant / row scoping — put it on a base service

Reads and writes are scoped by **different** hooks. Scoping only reads leaves
`PUT`/`DELETE /:id` open to other tenants' ids.

```ts
export abstract class TenantCrudService<T extends BaseEntity> extends CrudService<T> {
  protected abstract get tenantId(): string;

  protected async beforeFindMany(qb: SelectQueryBuilder<T>) {      // lists, aggregates
    return qb.andWhere(`${qb.alias}.tenantId = :t`, { t: this.tenantId });
  }
  protected async beforeFindOne(qb: SelectQueryBuilder<T>) {
    return qb.andWhere(`${qb.alias}.tenantId = :t`, { t: this.tenantId });
  }
  protected async beforeCounts(qb: SelectQueryBuilder<T>) {
    return qb.andWhere(`${qb.alias}.tenantId = :t`, { t: this.tenantId });
  }
  protected async beforeMutate(criteria: FindOptionsWhere<T>) {     // update/delete/restore/bulk/reorder
    return { ...criteria, tenantId: this.tenantId } as FindOptionsWhere<T>;
  }
  protected async beforeSave(data: Partial<T>) {                    // stamp new/changed rows
    return { ...data, tenantId: this.tenantId };
  }
}
```

- Read hooks must **return** the query builder and must not call `.select()`.
- `beforeMutate` criteria are plain columns (no joins). A non-matching row is a `404`
  (single) or skipped (bulk).
- To stop clients reading trashed rows with `?withDeleted=true`, override
  `allowSoftDeleteFilter()` to return `false` for non-privileged callers.
- Hide columns/relations from every query and response with `@CrudHidden()`.

## Write hooks

`beforeSave` → `beforeCreate`/`beforeUpdate` → save → `afterSave` → `afterCreate`/`afterUpdate`.

- The body is cleaned **before** hooks: on create the generated `id` and date/version
  columns are dropped (also from child rows), so a create always inserts; on update
  the body carries the stored row's `id`. Don't re-implement this.
- `beforeSave(data, request, ctx)`, `beforeCreate(data, request, ctx)` and
  `beforeUpdate(data, oldData, ctx)` all receive `ctx`: `ctx.action`, on updates
  `ctx.oldData` (the stored row — don't load it again), in bulk `ctx.manager`.
- **Bulk routes run in one transaction.** In a before-hook, database work must go
  through `ctx.manager` (not `this.repository`). After-hooks run after the commit.
- **Bulk replies list only what was written.** `PUT /bulk` skips an item with no id,
  a malformed id, or a row outside the `beforeMutate` scope, without an error —
  compare the ids you sent with the ids returned to report skips.
- Cap bulk requests with `@Crud({ maxBulkSize: 200 })` (or globally in
  `NestCrudModule.forRoot`); larger requests get `400`. There is no cap by default.
- A malformed id (not a UUID) is "not found": `404` on single routes, skipped in bulk.
  Don't add your own id-format checks.
- Don't save child rows yourself and then pass them to `create()` — let the cascade
  write them.
- Writing rows outside `CrudService.create()`? Clean the body with
  `stripServerManagedFields(repository.metadata, body)`.

## Custom routes and overrides

- New endpoint: a normal `@Get('active')` on the controller plus a service method.
- Override a generated route: define a method with the **same name** (`findMany`,
  `create`, …) and **no** `@Get`/`@Post` decorator.
- Shared endpoint on every resource via a base controller: give it a **two-segment**
  path (`@Get('summary/count')`), or the generated `/:id` captures it.
- Reuse `this.service.findMany(query)` in custom routes to keep filters and scoping.

## Common mistakes

| Symptom | Cause |
| --- | --- |
| Counts ignore a filter | Sent `where`/`onlyDeleted` as root params; they belong inside `filter` |
| Another tenant's row can be updated | Only read hooks are scoped; add `beforeMutate` |
| Scope added in a read hook has no effect | The hook didn't return the query builder |
| Bulk update hangs or hook sees old values | Hook used `this.repository` inside the bulk transaction; use `ctx.manager` |
| Bulk request with hundreds of items accepted | No cap by default; set `maxBulkSize` |
| Reorder fails with "column does not exist" | Set `protected reorderColumn = 'sortOrder'` on the service |
| Global `maxPageSize` not applied | Use `NestCrudModule.forRoot({ maxPageSize })` |
| Import error from `@ackplus/nest-crud/dist/...` | Import only from the package root |

## If the package itself looks wrong

Do not patch `node_modules`, deep-import internals, or quietly work around it.

1. Check the installed version (`npm ls @ackplus/nest-crud`) against the CHANGELOG —
   it may already be fixed.
2. Reduce it to the smallest entity + request that shows the problem.
3. Draft an issue for https://github.com/ack-solutions/nest-crud/issues/new/choose with:
   package version, NestJS/TypeORM/database versions, the entity and `@Crud()`
   options, the exact request, expected vs actual result. **Show the draft to the
   user and file it only if they agree.** Never include secrets or customer data.
4. If the app is blocked, add a workaround using public hooks only, with a comment
   linking the issue so it can be removed after the fix.
