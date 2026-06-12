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

### Two rules for read hooks

- **Don't call `.select()`** in `beforeFindMany` / `beforeFindOne` / `beforeCounts`.
  The library manages the select list (columns, relations, hidden-field stripping);
  overriding it breaks nested hydration. Use `andWhere`, `leftJoin`, `addOrderBy`,
  `setParameter` instead.
- **The aggregate path is separate.** When a request uses
  [`aggregates`](./querying.md#aggregates), `findMany` runs a two-phase query and
  `beforeFindMany` is **not** applied to it. To scope that path, override
  `createAggregateQueryBuilder()` (see below).

## Extending the query builder

For changes that go beyond per-request hooks, override the builder factories on the
service — your subclass controls construction:

| Override point | Customises |
| --- | --- |
| `createFindQueryBuilder()` | the normal list/read query builder |
| `createAggregateQueryBuilder()` | the two-phase aggregate execution |

These are documented with examples in
[Querying → Extending the service](./querying.md#extending-the-service).
