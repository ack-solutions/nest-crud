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
- **The aggregate path is separate.** When a request uses
  [`aggregates`](./querying.md#aggregates), `findMany` runs a two-phase query and
  `beforeFindMany` is **not** applied to it. To scope that path, override
  `createAggregateQueryBuilder()` (see below).

## Securing mutations (write-side scoping)

The `before*`/`after*` write hooks above receive the **already-loaded row**, so they
can *reject* a cross-tenant write — but only after the library has located it by id.
To make mutations safe by default, scope the **criteria** itself with `beforeMutate`.

### `beforeMutate(criteria, action)` — the write-side counterpart to read scoping

It runs for every mutation-by-id — `update`, `delete`, `deleteFromTrash`, `restore`,
and their bulk variants — and whatever criteria you return is what **loads and
mutates** the row(s). A row that doesn't match becomes invisible: single-row
mutations return `404`; bulk variants silently skip it.

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

For single-row calls `criteria` is `{ id }`; for bulk it's `{ id: In(ids) }`. Use the
`action` argument (a `CrudActionsEnum`) if you need to vary the rule per operation.
The criteria is column-level (TypeORM's `delete`/`update`/`restore` WHERE) — use
plain columns, not relation joins.

### `reorder` — `beforeReorder` + a configurable `reorderColumn`

`reorder` writes positions per id, so it can't be scoped by a WHERE. Instead, narrow
the id list in `beforeReorder` (e.g. to ids the caller owns), and point
`reorderColumn` at your entity's sort column (it defaults to `order`):

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
| `beforeMutate` | `update` / `delete` / `deleteFromTrash` / `restore` + bulk |
| `beforeReorder` (+ `reorderColumn`) | `reorder` |

## Extending the query builder

For changes that go beyond per-request hooks, override the builder factories on the
service — your subclass controls construction:

| Override point | Customises |
| --- | --- |
| `createFindQueryBuilder()` | the normal list/read query builder |
| `createAggregateQueryBuilder()` | the two-phase aggregate execution |

These are documented with examples in
[Querying → Extending the service](./querying.md#extending-the-service).
