# Custom routes & overrides

`@Crud()` generates the standard CRUD surface, but your **controller and service are
ordinary NestJS classes** — you extend them in your own project. You never fork or
copy the library: `npm install @ackplus/nest-crud` and add to it. On upgrade, your
custom code stays put.

Three things here: [add a new endpoint](#add-a-new-endpoint),
[override a generated one](#override-a-generated-endpoint), and a real
[streaming export](#recipe-streaming-export) recipe.

## Add a new endpoint

Add a method to your service, and a normal route to your controller. Custom routes
coexist with the generated ones — and static paths (`/active`) register **before** the
generated `/:id`, so they're never shadowed by `findOne('active')`.

```ts
// user.service.ts
@Injectable()
export class UserService extends CrudService<User> {
  constructor(@InjectRepository(User) public repository: Repository<User>) {
    super(repository);
  }

  findActiveUsers() {
    return this.repository.find({ where: { isActive: true } });
  }
}
```

```ts
// user.controller.ts
@Crud({ entity: User, path: 'users', routes: { findMany: { enabled: true } } })
export class UserController {
  constructor(public service: UserService) {}

  @Get('active')                                // GET /users/active
  active() { return this.service.findActiveUsers(); }
}
```

## Override a generated endpoint

**(a) Override the service method** — keep the route, change the logic. Reuse the base
with `super`:

```ts
@Injectable()
export class UserService extends CrudService<User> {
  async create(data: Partial<User>, saveOptions = {}) {
    data.referralCode = await this.generateCode();
    return super.create(data, saveOptions);     // POST /users still works
  }
}
```

**(b) Override the route handler** — define a method with the **same name** as the
route. Do **not** add `@Get`/`@Post`; the factory wires the path, method, guards, and
Swagger for you (your `@UseGuards` / `@ApiOperation` are merged):

```ts
@Crud({ entity: User, path: 'users', routes: { findMany: { enabled: true } } })
export class UserController {
  constructor(public service: UserService) {}

  // overrides GET /users
  async findMany(@Query() query: any) {
    const page = await this.service.findMany(query);
    return { ...page, meta: { generatedAt: Date.now() } };
  }
}
```

Overridable names: `findMany`, `findAll`, `counts`, `findOne`, `create`, `createMany`,
`update`, `updateMany`, `delete`, `deleteMany`, `restore`, `restoreMany`,
`deleteFromTrash`, `deleteFromTrashMany`, `reorder`.

## Recipe: streaming export

Export everything that matches the current filters — **without loading it all into
memory**. Reuse `findMany` in a batched async generator, and stream the rows as
**NDJSON** (one JSON object per line). `findMany` already parses the query, so the
export honours the **same** `where` / `relations` / `order` / `select` / soft-delete
flags as `GET /users`.

```ts
// user.service.ts
import { CrudService, IFindManyOptions } from '@ackplus/nest-crud';

@Injectable()
export class UserService extends CrudService<User> {
  // …constructor…

  /** Stream every matching user one-by-one, reusing the findMany pipeline. */
  async *exportAll(query: IFindManyOptions = {}, batchSize = 100): AsyncIterable<User> {
    let skip = 0;
    for (;;) {
      const { items } = await this.findMany({ ...query, take: batchSize, skip });
      if (items.length === 0) break;
      for (const user of items) yield user;     // one by one
      if (items.length < batchSize) break;      // last page
      skip += batchSize;
    }
  }
}
```

```ts
// user.controller.ts
import { Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

@Crud({ entity: User, path: 'users', routes: { findMany: { enabled: true } } })
export class UserController {
  constructor(public service: UserService) {}

  @Get('export')
  async exportUsers(@Query() query: Record<string, any>, @Res() res: Response) {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="users.ndjson"');
    try {
      for await (const user of this.service.exportAll(query)) {
        res.write(JSON.stringify(user) + '\n'); // one row per line
      }
      res.end();
    } catch (err) {
      res.destroy(err as Error); // headers already sent — abort on error
    }
  }
}
```

**Why this shape:**
- **Reuses `findMany`** → same filters, relation hydration, hidden-field stripping, and the `beforeFindMany` hook.
- **Memory-safe** → only one `batchSize` page is in memory at a time, so 1,000 or 1,000,000 rows export the same way.
- **NDJSON** → the client processes rows as they arrive instead of buffering one huge JSON array.
- **`@Res()`** opts out of Nest's response serialisation so you can stream manually.

**Consume it:**

```bash
# everything, newest first
curl 'http://localhost:3000/users/export?order={"createdAt":"DESC"}'

# same filters as GET /users — only active users, with their posts
curl 'http://localhost:3000/users/export?where={"isActive":{"$eq":true}}&relations=["posts"]'
```

Each line is one user object — pipe to a file or `jq`. For **CSV**, write a header
line first, then map each `user` to a comma-joined row instead of `JSON.stringify`.

> **Advanced — single DB cursor.** For the lowest overhead you can stream straight from
> the database with TypeORM's `QueryBuilder.stream()`, built from the same filters:
> ```ts
> async *exportRaw(query: IFindManyOptions = {}) {
>   const qb = this.createFindQueryBuilder().build(query); // same where/relations
>   const stream = await qb.stream();                      // DB cursor
>   for await (const raw of stream) yield raw;
> }
> ```
> One query instead of N, but it yields **raw rows** (aliased columns, no relation
> hydration). Use the batched `findMany` version when you want full entities.

## Lighter options (no new route)

- **Lifecycle hooks** — `beforeFindMany`, `beforeCreate`, `afterCreate`, … for scoping,
  defaults, and side effects. See [Lifecycle hooks](./lifecycle-hooks.md).
- **Builder extension points** — `createFindQueryBuilder()` / `createAggregateQueryBuilder()`.

A runnable version of everything here (the `active`, `role/:role`, `email/:email`, and
`export` routes) lives in [`apps/example-app/src/users`](https://github.com/ack-solutions/nest-crud/tree/main/apps/example-app/src/users).
