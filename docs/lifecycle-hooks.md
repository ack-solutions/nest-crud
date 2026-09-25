# Lifecycle hooks

Override `protected` methods on your `CrudService` subclass to inject behaviour
around each action. All hooks are `async`.

## Write hooks

`beforeSave` / `beforeCreate` / `beforeUpdate` run before persistence; the
`after*` variants run after. Use them to normalise input, set server-side fields,
or trigger side effects.

```ts
@Injectable()
export class UserService extends CrudService<User> {
  constructor(@InjectRepository(User) public repository: Repository<User>) {
    super(repository);
  }

  // Hash the password before any create/update save.
  protected async beforeSave(entity: Partial<User>) {
    if (entity.password) {
      entity.password = await bcrypt.hash(entity.password, 10);
    }
    return entity;
  }

  // Fire a side effect after creation.
  protected async afterCreate(user: User) {
    await this.mailer.sendWelcome(user.email);
    return user;
  }
}
```

| Hook | Runs around |
| --- | --- |
| `beforeSave` / `afterSave` | every create and update save |
| `beforeCreate` / `afterCreate` | `create` (and per item in `createMany`) |
| `beforeUpdate` / `afterUpdate` | `update` (and per item in `updateMany`) |
| `beforeDelete` / `afterDelete` | `delete` |
| `beforeDeleteMany` / `afterDeleteMany` | `deleteMany` |
| `beforeRestore` / `afterRestore` | `restore` |
| `beforeRestoreMany` / `afterRestoreMany` | `restoreMany` |
| `beforeDeleteFromTrash` / `afterDeleteFromTrash` | `deleteFromTrash` |
| `beforeDeleteFromTrashMany` / `afterDeleteFromTrashMany` | `deleteFromTrashMany` |

### What the write hooks receive

The body is sanitized **before** any hook runs, so hooks work on a trustworthy
payload — and anything a hook sets (including the fields below) is kept:

- **Create always inserts.** `create` / `createMany` drop the generated primary key
  and the create / update / delete date and version columns from the row and,
  recursively, from its owned child rows (one-to-many arrays, inverse one-to-one
  objects). So a `POST` carrying an existing row's `id` inserts a new row instead of
  overwriting that one, and a child sent with an `id` is inserted fresh rather than
  moved under the new parent. **References keep their ids** — many-to-one objects,
  `...Id` columns and many-to-many links still point at existing rows.
- **Updates know their row.** `update` / `updateMany` set the primary key on the
  body to the stored row's (a body `id` naming another row is replaced) and drop
  the date / version columns (so a client can't backdate a row, or soft-delete it
  through `PUT`).

`beforeSave` gets a third argument describing the save, including the stored row
on updates — handy for merging a partial body or locking a row after a status
change without loading it again:

```ts
protected async beforeSave(data: Partial<Invoice>, _req?: any, ctx?: CrudSaveContext<Invoice>) {
  if (ctx?.oldData?.status === 'confirmed') {
    throw new BadRequestException('Confirmed invoices are locked');
  }
  return data;
}
```

`ctx.action` is `create` / `createMany` / `update` / `updateMany`; `ctx.oldData` is
set for the two update actions.

::: warning Upgrading from ≤ 2.1
If you pre-saved child rows yourself and then passed them (with their ids) into
`create()`, those ids are now dropped and the children would be inserted twice —
let the cascade save them instead. If clients must supply their own ids (e.g.
offline-generated UUIDs), override `prepareCreateData(data)` to return `data`
unchanged, and guard against overwrites yourself. For your own non-CRUD create
paths, reuse the same rule with the exported `stripServerManagedFields(metadata, body)`.
:::

## Read hooks — **must return the query builder**

`beforeFindMany`, `beforeFindOne`, and `beforeCounts` receive the TypeORM
`SelectQueryBuilder` and **must return it** (or a modified one). This is the place
for tenant scoping, row-level security, or forced ordering.

```ts
@Injectable()
export class DocumentService extends CrudService<Document> {
  constructor(
    @InjectRepository(Document) public repository: Repository<Document>,
    private readonly tenant: TenantContext,
  ) {
    super(repository);
  }

  protected async beforeFindMany(qb: SelectQueryBuilder<Document>) {
    return qb.andWhere(`${qb.alias}.tenantId = :tenantId`, { tenantId: this.tenant.id });
  }

  protected async beforeFindOne(qb: SelectQueryBuilder<Document>) {
    return qb.andWhere(`${qb.alias}.tenantId = :tenantId`, { tenantId: this.tenant.id });
  }
}
```

> Returning a new/modified builder is required — a scoping constraint added in
> `beforeFindOne` is only applied because the returned builder is used.

> ⚠️ **Read hooks do not protect writes.** `beforeFindMany` / `beforeFindOne` only
> scope reads. By default `update` / `delete` / `restore` (and the bulk variants)
> locate the row by **id alone**, so scoping only your reads still leaves mutations
> cross-tenant exploitable (a user could `PUT`/`DELETE /:id` another tenant's row).
> Scope writes too — see [Securing mutations](#securing-mutations-write-side-scoping).

### Two rules for read hooks

- **Don't call `.select()`** in `beforeFindMany` / `beforeFindOne` / `beforeCounts`.
  The library manages the select list (columns, relations, hidden-field stripping);
  overriding it breaks nested hydration. Use `andWhere`, `leftJoin`, `addOrderBy`,
  `setParameter` instead.
- **The aggregate path is covered.** When a request uses
  [`aggregates`](./querying.md#aggregates), `findMany` runs a two-phase query — and
  `beforeFindMany` **is** applied to it (its constraints run on the query that picks
  the rows), so your tenant/visibility scoping holds for aggregate requests too. For
  changes beyond `andWhere`-style scoping, override `createAggregateQueryBuilder()`.

## Gating the soft-delete flags

`withDeleted` / `onlyDeleted` are query **capabilities**, not authorization — any
caller can append `?withDeleted=true` and read trashed rows unless you stop them.
Override `allowSoftDeleteFilter()` to refuse them (e.g. only managers see the trash);
return `false` and the flags are forced off for that request across **every read**
— `findMany` / `findAll` / `findOne` / `counts`, including the aggregate path — so
the read sees only live rows:

```ts
@Injectable()
export class PollService extends CrudService<Poll> {
  // members never see soft-deleted rows, whatever the query string says
  protected async allowSoftDeleteFilter() {
    return this.ctx.isManager;
  }
}
```

(Or enforce it in `beforeFindMany` with an explicit `deletedAt IS NULL` — the hook is
just the declarative shortcut.)

## Securing mutations (write-side scoping)

The `before*`/`after*` write hooks above receive the **already-loaded row**, so they
can *reject* a cross-tenant write — but only after the library has located it by id.
To make mutations safe by default, scope the **criteria** itself with `beforeMutate`.

### `beforeMutate(criteria, action)` — the write-side counterpart to read scoping

It runs for every mutation-by-id — `update`, `delete`, `deleteFromTrash`, `restore`,
their bulk variants, and each per-row write of `reorder` — and whatever criteria you
return is what **loads and mutates** the row(s). A row that doesn't match becomes
invisible: single-row mutations return `404`; bulk variants and `reorder` silently
skip it.

```ts
@Injectable()
export class DocumentService extends CrudService<Document> {
  constructor(
    @InjectRepository(Document) public repository: Repository<Document>,
    private readonly tenant: TenantContext,
  ) {
    super(repository);
  }

  // Every update/delete/restore is now AND-ed with the tenant column.
  protected async beforeMutate(criteria: FindOptionsWhere<Document>) {
    return { ...criteria, tenantId: this.tenant.id };
  }
}
```

For single-row calls (and each reorder write) `criteria` is `{ id }`; for bulk it's
`{ id: In(ids) }`. Use the
`action` argument (a `CrudActionsEnum`) if you need to vary the rule per operation.
The criteria is column-level (TypeORM's `delete`/`update`/`restore` WHERE) — use
plain columns, not relation joins.

### `reorder` — `beforeReorder` + a configurable `reorderColumn`

Each `reorder` write goes through `beforeMutate` like every other mutation, so a
tenant scope there already keeps it inside the tenant (foreign ids are skipped).
Optionally drop foreign ids up front in `beforeReorder` so the positions written
stay contiguous (0, 1, 2…), and point `reorderColumn` at your entity's sort column
(it defaults to `order`):

```ts
@Injectable()
export class BlockService extends CrudService<Block> {
  protected reorderColumn = 'sortOrder'; // not the default `order`

  protected async beforeReorder(ids: ID[]) {
    const owned = await this.repository.find({
      where: { id: In(ids), propertyId: this.tenant.id } as any,
      select: ['id'],
    });
    const ownedIds = new Set(owned.map((r) => r.id));
    return ids.filter((id) => ownedIds.has(id as string)); // order preserved
  }
}
```

`reorder` throws `400` if `reorderColumn` isn't a real column on the entity.

### Complete tenant isolation in one base service

Scope reads **and** writes once on a base service, and every `@Crud` resource that
extends it is isolated — no per-controller wiring:

```ts
export abstract class TenantCrudService<T extends BaseEntity> extends CrudService<T> {
  protected abstract get tenantId(): string;

  // reads
  protected async beforeFindMany(qb: SelectQueryBuilder<T>) {
    return qb.andWhere(`${qb.alias}.tenantId = :t`, { t: this.tenantId });
  }
  protected async beforeFindOne(qb: SelectQueryBuilder<T>) {
    return qb.andWhere(`${qb.alias}.tenantId = :t`, { t: this.tenantId });
  }
  // writes
  protected async beforeMutate(criteria: FindOptionsWhere<T>) {
    return { ...criteria, tenantId: this.tenantId } as FindOptionsWhere<T>;
  }
}
```

| Hook | Scopes |
| --- | --- |
| `beforeFindMany` / `beforeFindOne` / `beforeCounts` | reads (return the query builder) |
| `beforeMutate` | `update` / `delete` / `deleteFromTrash` / `restore` + bulk, and `reorder` |
| `beforeReorder` (+ `reorderColumn`) | `reorder` id list / column |

## Extending the query builder

For changes that go beyond per-request hooks, override the builder factories on the
service — your subclass controls construction:

| Override point | Customises |
| --- | --- |
| `createFindQueryBuilder()` | the normal list/read query builder |
| `createAggregateQueryBuilder()` | the two-phase aggregate execution |

These are documented with examples in
[Querying → Extending the service](./querying.md#extending-the-service).
