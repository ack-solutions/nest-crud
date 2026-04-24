# @ackplus/nest-crud

CRUD route generator for **NestJS + TypeORM**. One decorator turns a controller into a full REST resource with filtering, relations, select, sorting, pagination, bulk ops, soft-delete, and Swagger metadata.

- One decorator: `@Crud()`
- One service base class: `CrudService<T>`
- One request format: `where`, `relations`, `select`, `order`, `take`, `skip`, `withDeleted`, `onlyDeleted`
- 26 operators + `$and` / `$or`

---

## Table of contents

1. [Install](#install)
2. [Quick start](#quick-start)
3. [`@Crud()` decorator](#crud-decorator)
4. [Generated routes](#generated-routes)
5. [`CrudService<T>`](#crudservicet)
6. [Request query format](#request-query-format)
7. [Where operators](#where-operators)
8. [Relations, select, order, pagination](#relations-select-order-pagination)
9. [Soft delete & trash](#soft-delete--trash)
10. [Bulk operations](#bulk-operations)
11. [Counts & grouped counts](#counts--grouped-counts)
12. [Reorder](#reorder)
13. [Lifecycle hooks](#lifecycle-hooks)
14. [DTOs & validation](#dtos--validation)
15. [Overriding generated routes](#overriding-generated-routes)
16. [Global defaults (`CrudConfigService`)](#global-defaults-crudconfigservice)
17. [Base entities](#base-entities)
18. [Exported helpers](#exported-helpers)
19. [Calling the API without the request builder](#calling-the-api-without-the-request-builder)
20. [Known limitations](#known-limitations)

---

## Install

```bash
npm install @ackplus/nest-crud
```

Peer dependencies (install in your app):

```bash
npm install @nestjs/common @nestjs/core @nestjs/platform-express \
  @nestjs/swagger @nestjs/typeorm typeorm \
  class-validator class-transformer reflect-metadata
```

Declared peer ranges:

| Peer | Range |
| --- | --- |
| `@nestjs/common` | `^10 \|\| ^11` |
| `@nestjs/core` | `^10 \|\| ^11` |
| `@nestjs/platform-express` | `^10 \|\| ^11` |
| `@nestjs/swagger` | `^10 \|\| ^11` |
| `@nestjs/typeorm` | `^10 \|\| ^11` |
| `typeorm` | `^0.3.21` |
| `class-validator` | `^0.14.1` |
| `class-transformer` | `^0.5.1` |
| `reflect-metadata` | `^0.1.13` |

Want a type-safe client for these routes? See [`@ackplus/nest-crud-request`](../nest-crud-request/README.md).

---

## Quick start

```ts
import { Module, Injectable } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Entity, Column, Repository } from 'typeorm';
import { BaseEntity, Crud, CrudService } from '@ackplus/nest-crud';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;
}

@Injectable()
export class UserService extends CrudService<User> {
  constructor(@InjectRepository(User) repository: Repository<User>) {
    super(repository);
  }
}

@Crud({
  path: 'users',
  entity: User,
  routes: {
    findMany: { enabled: true },
    findOne: { enabled: true },
    create: { enabled: true },
    update: { enabled: true },
    delete: { enabled: true },
  },
})
export class UserController {
  constructor(public service: UserService) {}
}

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
```

Routes generated:

| Route | Returns |
| --- | --- |
| `GET /users` | `{ items: User[], total: number }` |
| `GET /users/:id` | `User` |
| `POST /users` | `User` |
| `PUT /users/:id` | `User` |
| `DELETE /users/:id` | `{ message: string }` |

---

## `@Crud()` decorator

`@Crud()` is the single entry point. It:

- Applies `@Controller(options.path)` to the class
- Generates handler methods for enabled routes (skips any you define yourself)
- Attaches route-level guards, interceptors, and decorators
- Applies validation pipes and Swagger metadata

### `CrudOptions`

| Field | Type | Notes |
| --- | --- | --- |
| `entity` | `Function` | **Required.** TypeORM entity class |
| `path` | `string` | Controller path. Defaults to entity name |
| `name` | `string` | Resource name (used for Swagger tag) |
| `routes` | `Partial<CrudRoutesOptions>` | Per-route config (see below) |
| `dto` | `{ create?, update? }` | DTO classes for request bodies & Swagger |
| `validation` | `ValidationPipeOptions` | Passed to `new ValidationPipe(...)` |
| `softDelete` | `boolean` | Enables `/:id/restore`, `/:id/trash`, `/restore/bulk`, `/trash/bulk` |
| `select` | `string[]` | Default columns included in list queries |
| `hiddenFields` | `string[]` | Columns always excluded from responses |
| `maxPerPage` | `number` | Cap on `take` / `limit`. Defaults to global (5000) |
| `maxPageSize` | `number` | Legacy alias for `maxPerPage` |
| `query` | `{ relations?: string[] }` | Default relations for list queries |
| `debug` | `boolean` | Log SQL via the debug helper (also honors `NEST_CRUD_DEBUG=1`) |

### `RouteOptions` (per route)

```ts
routes: {
  findMany: {
    enabled: true,
    path: '/',                  // override default path
    method: RequestMethod.GET,  // override HTTP method
    guards: [AuthGuard],
    interceptors: [CacheInterceptor],
    decorators: [SetMetadata('role', 'admin')],
  },
  createMany: { enabled: false },
}
```

Every generated route accepts: `enabled`, `path`, `method`, `guards`, `interceptors`, `decorators`. Use an object form (not a plain boolean) when you want to pass guards or interceptors.

---

## Generated routes

Default paths (relative to the controller `path`):

| Action | Method | Path | Body / Query | Response |
| --- | --- | --- | --- | --- |
| `findMany` | `GET` | `/` | query | `{ items: T[], total: number }` |
| `findAll` | `GET` | `/get/all` | query | `T[]` |
| `counts` | `GET` | `/get/counts` | query | `{ total: number, data?: Array<{ count: number } & Record<string, any>> }` |
| `findOne` | `GET` | `/:id` | query | `T` |
| `create` | `POST` | `/` | body `Partial<T>` | `T` |
| `createMany` | `POST` | `/bulk` | body `{ bulk: Partial<T>[] }` | `T[]` |
| `update` | `PUT` | `/:id` | body `Partial<T>` | `T` |
| `updateMany` | `PUT` | `/bulk` | body `{ bulk: (Partial<T> & { id })[] }` | `T[]` |
| `delete` | `DELETE` | `/:id` | — | `{ message: string }` |
| `deleteMany` | `DELETE` | `/delete/bulk` | query `ids[]` | `{ message: string }` |
| `deleteFromTrash` ⁽ˢ⁾ | `DELETE` | `/:id/trash` | — | `{ success: true, message: string }` |
| `deleteFromTrashMany` ⁽ˢ⁾ | `DELETE` | `/trash/bulk` | query `ids[]` | `{ success: true, message: string }` |
| `restore` ⁽ˢ⁾ | `PUT` | `/:id/restore` | — | `{ success: true, message: string }` |
| `restoreMany` ⁽ˢ⁾ | `PUT` | `/restore/bulk` | body `{ ids: ID[] }` | `{ success: true, message: string }` |
| `reorder` | `PUT` | `/reorder` | body `ID[]` | `void` |

⁽ˢ⁾ requires `softDelete: true` in `@Crud()`.

Update is **`PUT`**, not `PATCH`.

---

## `CrudService<T>`

Extend `CrudService<T>` and pass a TypeORM `Repository<T>` to `super()`. All generated routes delegate to this service, so anything you can do from a route you can do from code.

```ts
@Injectable()
export class UserService extends CrudService<User> {
  constructor(@InjectRepository(User) repository: Repository<User>) {
    super(repository);
  }
}
```

### Methods

| Method | Signature |
| --- | --- |
| `findMany` | `(query: IFindManyOptions, crudOptions?) => Promise<{ items: T[]; total: number }>` |
| `findAll` | `(query: IFindManyOptions, crudOptions?) => Promise<T[]>` |
| `counts` | `(request: ICountsRequest, crudOptions?) => Promise<{ total: number; data?: ... }>` |
| `findOne` | `(id: ID, query?: IFindOneOptions) => Promise<T>` *(throws `NotFoundException`)* |
| `create` | `(data: Partial<T>, saveOptions?: SaveOptions) => Promise<T>` |
| `createMany` | `(data: { bulk: Partial<T>[] }, saveOptions?: SaveOptions) => Promise<T[]>` |
| `update` | `(idOrWhere: ID \| FindOptionsWhere<T>, data: Partial<T>) => Promise<T>` |
| `updateMany` | `(data: { bulk: (Partial<T> & { id: ID })[] }) => Promise<T[]>` |
| `delete` | `(idOrWhere: ID \| FindOptionsWhere<T>, softDelete?: boolean) => Promise<{ message }>` |
| `deleteMany` | `(params: { ids?: ID[] }, softDelete?: boolean) => Promise<{ message }>` |
| `deleteFromTrash` | `(idOrWhere) => Promise<{ success: true; message }>` |
| `deleteFromTrashMany` | `(params: { ids?: ID[] }) => Promise<{ success: true; message }>` |
| `restore` | `(idOrWhere) => Promise<{ success: true; message }>` |
| `restoreMany` | `(params: { ids: ID[] }) => Promise<{ success: true; message }>` |
| `reorder` | `(ids: ID[]) => Promise<void>` |

`findMany` is paginated; `findAll` always returns a plain array and ignores `skip`.

---

## Request query format

All list endpoints accept these top-level query params:

| Key | Type | Notes |
| --- | --- | --- |
| `where` | JSON string / bracket notation / object | Filter conditions |
| `relations` | JSON string / array / object | Which relations to load |
| `select` | JSON string / array | Columns to return |
| `order` | JSON string / object | Sort, e.g. `{ createdAt: 'DESC' }` |
| `take` *(or `limit`)* | number | Page size — capped by `maxPerPage` |
| `skip` *(or `offset`)* | number | Offset |
| `withDeleted` | boolean | Include soft-deleted rows |
| `onlyDeleted` | boolean | Return only soft-deleted rows |

Any other keys are passed through on the parsed result, so you can read them in custom handlers or interceptors.

Input is parsed by `RequestQueryParser.parse(query)` (uses `qs` for bracket notation, then JSON-parses string values and coerces primitives). All three of these are equivalent:

```http
# JSON string
GET /users?where={"isActive":{"$eq":true}}

# Bracket notation
GET /users?where[isActive][$eq]=true

# Plain ?key=value (equality shorthand)
GET /users?where[isActive]=true
```

---

## Where operators

```http
GET /users?where={"age":{"$gte":18},"role":{"$in":["admin","editor"]}}
```

| Operator | Meaning |
| --- | --- |
| `$eq` | Equal (default if you write a scalar) |
| `$ne` | Not equal |
| `$gt` / `$gte` | Greater than / or equal |
| `$lt` / `$lte` | Less than / or equal |
| `$in` / `$notIn` | In / not in array |
| `$like` / `$notLike` | SQL `LIKE` / `NOT LIKE` |
| `$iLike` / `$notIlike` | Case-insensitive `LIKE` / `NOT LIKE` |
| `$startsWith` / `$endsWith` | Prefix / suffix match |
| `$iStartsWith` / `$iEndsWith` | Case-insensitive prefix / suffix match |
| `$inL` / `$notinL` | Case-insensitive `IN` / `NOT IN` |
| `$contArr` | Postgres array contains (`@>`) |
| `$intersectsArr` | Postgres array intersects (`&&`) |
| `$isNull` / `$isNotNull` | `IS NULL` / `IS NOT NULL` (no value) |
| `$between` / `$notBetween` | Range `[start, end]` |
| `$isTrue` / `$isFalse` | Boolean truthiness |
| `$and` / `$or` | Logical combinators |

Combinators nest arbitrarily:

```json
{
  "$or": [
    { "role": { "$eq": "admin" } },
    { "$and": [
      { "role": { "$eq": "editor" } },
      { "verified": { "$isTrue": true } }
    ]}
  ]
}
```

`$contArr` and `$intersectsArr` are **PostgreSQL only** — the query builder throws on other dialects.

---

## Relations, select, order, pagination

```http
# strings
GET /users?relations=["posts","profile"]

# nested with select
GET /users?relations={"posts":{"select":["id","title"]}}

# filter the relation rows
GET /users?relations={"posts":{"where":{"published":{"$eq":true}}}}

# inner-join instead of left-join
GET /users?relations={"posts":{"joinType":"inner"}}

# root select
GET /users?select=["id","email","firstName"]

# sort
GET /users?order={"createdAt":"DESC","email":"ASC"}

# paginate
GET /users?take=20&skip=40

# soft delete
GET /users?withDeleted=true
GET /users?onlyDeleted=true
```

Relation object shape:

```ts
type RelationObjectValue = {
  select?: string[];
  where?: WhereObject | WhereObject[];
  joinType?: 'left' | 'inner'; // default 'left'
};
```

---

## Soft delete & trash

Add `softDelete: true` to `@Crud()` and make sure your entity has a `@DeleteDateColumn()` (`BaseEntity` already has one).

```ts
@Crud({
  path: 'users',
  entity: User,
  softDelete: true,
  routes: {
    /* regular routes */
    findMany: { enabled: true },
    delete: { enabled: true },
    /* trash routes become available */
    restore: { enabled: true },
    restoreMany: { enabled: true },
    deleteFromTrash: { enabled: true },
    deleteFromTrashMany: { enabled: true },
  },
})
```

| Action | Endpoint | Effect |
| --- | --- | --- |
| `DELETE /users/:id` | Soft delete (sets `deletedAt`) when `softDelete: true` |
| `PUT /users/:id/restore` | Clears `deletedAt` |
| `DELETE /users/:id/trash` | Permanent delete of a soft-deleted row |
| `PUT /users/restore/bulk` | Bulk restore by `{ ids }` |
| `DELETE /users/trash/bulk` | Bulk permanent delete |

Use `?withDeleted=true` or `?onlyDeleted=true` to see or isolate trash rows.

---

## Bulk operations

### Create many

```http
POST /users/bulk
Content-Type: application/json

{ "bulk": [
  { "email": "a@x.io", "firstName": "A" },
  { "email": "b@x.io", "firstName": "B" }
]}
```

### Update many

```http
PUT /users/bulk
Content-Type: application/json

{ "bulk": [
  { "id": "uuid-1", "firstName": "Alice" },
  { "id": "uuid-2", "firstName": "Bob" }
]}
```

### Delete many

```http
DELETE /users/delete/bulk?ids=uuid-1&ids=uuid-2
```

---

## Counts & grouped counts

```http
# total count with filter
GET /users/get/counts?filter={"where":{"isActive":{"$eq":true}}}

# grouped count
GET /users/get/counts?filter={"where":{"isActive":{"$eq":true}}}&groupByKey=role
# -> { total: 120, data: [{ role: 'admin', count: 5 }, { role: 'user', count: 115 }] }
```

- `filter` uses the same shape as `findMany` query (minus pagination — it's stripped).
- `groupByKey` accepts a single column or an array of columns.

---

## Reorder

Use `BaseEntityWithOrder` (adds an `order` int column) and enable the `reorder` route.

```http
PUT /users/reorder
Content-Type: application/json

["uuid-3", "uuid-1", "uuid-2"]
```

Position in the array becomes the new `order` value for each row.

---

## Lifecycle hooks

Override any of these protected methods in your service:

```ts
@Injectable()
export class UserService extends CrudService<User> {
  constructor(@InjectRepository(User) repository: Repository<User>) { super(repository); }

  protected async beforeSave(entity: Partial<User>) {
    if (entity.email) entity.email = entity.email.trim().toLowerCase();
    return entity;
  }

  protected async beforeFindMany(qb: SelectQueryBuilder<User>) {
    qb.andWhere('user.tenantId = :tenantId', { tenantId: this.currentTenant() });
    return qb;
  }
}
```

Full list:

| Create / update | Query | Delete | Trash / restore |
| --- | --- | --- | --- |
| `beforeSave`, `afterSave` | `beforeFindMany` | `beforeDelete`, `afterDelete` | `beforeDeleteFromTrash`, `afterDeleteFromTrash` |
| `beforeCreate`, `afterCreate` | `beforeFindOne` | `beforeDeleteMany`, `afterDeleteMany` | `beforeDeleteFromTrashMany`, `afterDeleteFromTrashMany` |
| `beforeUpdate`, `afterUpdate` | `beforeCounts` | | `beforeRestore`, `afterRestore` |
| | | | `beforeRestoreMany`, `afterRestoreMany` |

`beforeFindMany`, `beforeFindOne`, and `beforeCounts` receive the TypeORM `SelectQueryBuilder<T>` and must return it (after mutation). The rest receive entity / id input and return it.

---

## DTOs & validation

```ts
@Crud({
  path: 'users',
  entity: User,
  dto: {
    create: CreateUserDto,
    update: UpdateUserDto,
  },
  validation: {
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  },
})
```

This wires up class-validator / class-transformer for the request body and uses the DTO classes for Swagger request models. If you need different rules for create vs update, use class-validator validation groups — the enum `CrudValidationGroupsEnum` (`CREATE`, `UPDATE`) is exported for this.

---

## Overriding generated routes

Define a method with the same name as a CRUD action on your controller. `@Crud()` will keep **your** method and still apply route metadata, Swagger metadata, and pipes. Don't add `@Get()` / `@Post()` / etc. yourself — the decorator handles it.

```ts
import { Query } from '@nestjs/common';
import { CRUD_OPTIONS_METADATA, RequestQueryParser } from '@ackplus/nest-crud';

@Crud({
  path: 'users',
  entity: User,
  routes: { findMany: { enabled: true } },
})
export class UserController {
  constructor(public service: UserService) {}

  async findMany(@Query() query: any) {
    const crudOptions = Reflect.getMetadata(CRUD_OPTIONS_METADATA, this.constructor);
    const parsed = RequestQueryParser.parse(query);

    parsed.where = parsed.where
      ? { $and: [parsed.where, { isActive: { $eq: true } }] }
      : { isActive: { $eq: true } };

    return this.service.findMany(parsed, crudOptions);
  }
}
```

---

## Global defaults (`CrudConfigService`)

Set package-wide defaults once (e.g. in `main.ts` before `NestFactory.create`):

```ts
import { CrudConfigService } from '@ackplus/nest-crud';

CrudConfigService.load({
  maxPageSize: 1000,
  routes: {
    findMany: { enabled: true },
    create: { enabled: true },
    // anything you set here applies to every @Crud() controller
  },
});
```

`CrudConfigService.load(config)` deep-merges `config` into the static defaults. Per-controller `@Crud({ ... })` options then merge on top.

The `NestCrudModule` is exported for symmetry, but it currently only re-imports `TypeOrmModule` and has no providers. You do **not** have to import it — everything works via the decorator and your own `TypeOrmModule.forFeature([...])` imports.

---

## Base entities

```ts
import { BaseEntity, BaseEntityWithOrder } from '@ackplus/nest-crud';
```

`BaseEntity` provides:

| Column | Type | Source |
| --- | --- | --- |
| `id` | `string` (UUID) | `@PrimaryGeneratedColumn('uuid')` |
| `createdAt` | `Date` | `@CreateDateColumn()` |
| `updatedAt` | `Date` | `@UpdateDateColumn()` |
| `deletedAt` | `Date` | `@DeleteDateColumn()` (enables soft-delete) |

`BaseEntityWithOrder` extends `BaseEntity` and adds `order: number` (default 0) for use with the `reorder` route.

You don't have to use these classes. Any TypeORM entity with a column named `id` will work.

---

## Exported helpers

| Export | Purpose |
| --- | --- |
| `Crud` | Controller decorator |
| `CrudService` | Service base class |
| `BaseEntity`, `BaseEntityWithOrder` | Starter entities |
| `NestCrudModule` | Empty module (optional) |
| `CrudConfigService` | Global defaults |
| `FindQueryBuilder` | Build a TypeORM `SelectQueryBuilder` from an `IFindManyOptions` |
| `RequestQueryParser` | Normalize raw Express query into `IFindManyOptions` |
| `getAction(handler)` | Read the CRUD action name from a route handler (useful in interceptors) |
| `applyListPagination`, `applyNoPaginationLimit`, `sanitizeCountsFilter`, `resolveMaxPerPage`, `assertTakeWithinMaxPerPage` | Pagination helpers |
| `CRUD_OPTIONS_METADATA`, `CRUD_ACTION_METADATA`, `CRUD_AUTH_OPTIONS_METADATA`, `DEFAULT_MAX_PER_PAGE` | Constants |
| `CrudActionsEnum`, `CrudValidationGroupsEnum`, `WhereOperatorEnum`, `WhereLogicalOperatorEnum`, `OrderDirectionEnum` | Enums |
| `CrudOptions`, `RouteOptions`, `CrudRoutesOptions`, `PaginationResponse`, `ListResponse`, `FindAllResponse`, `IFindManyOptions`, `IFindOneOptions`, `ICountsRequest`, `ICountsResult`, `IDeleteManyOptions`, `ID`, `WhereObject`, `WhereOptions`, `RelationObject`, `RelationObjectValue`, `RelationOptions` | Types |

---

## Calling the API without the request builder

You can hit the API with plain `fetch`, `axios`, or `curl`. Send `where`, `relations`, `select`, `order` as JSON strings; send the rest as normal query params.

### fetch

```ts
const params = new URLSearchParams({
  where: JSON.stringify({ isActive: { $eq: true } }),
  relations: JSON.stringify({ posts: { select: ['id', 'title'] } }),
  select: JSON.stringify(['id', 'email', 'firstName']),
  order: JSON.stringify({ createdAt: 'DESC' }),
  take: '10',
  skip: '0',
});
const res = await fetch(`/users?${params}`);
```

### axios

```ts
await axios.get('/users', {
  params: {
    where: JSON.stringify({ role: { $in: ['admin', 'moderator'] } }),
    order: JSON.stringify({ createdAt: 'DESC' }),
    take: 20,
    skip: 0,
  },
});
```

### curl

```bash
curl -G http://localhost:3000/users \
  --data-urlencode 'where={"isActive":{"$eq":true}}' \
  --data-urlencode 'order={"createdAt":"DESC"}' \
  --data-urlencode 'take=10'
```

### Bracket notation

```http
GET /users?where[isActive][$eq]=true&order[createdAt]=DESC&take=10
```

If you'd rather not assemble strings by hand, install [`@ackplus/nest-crud-request`](../nest-crud-request/README.md) and use `QueryBuilder`.

---

## Known limitations

- `CrudService` and route handlers assume the primary key field is named `id`.
- `reorder` expects a plain `ID[]` body — the generated Swagger for it is minimal.
- `deleteMany` takes `{ ids }`, not a `where` clause.
- `NestCrudModule` is exported but currently has no providers; configuration happens via `CrudConfigService.load()` and `@Crud(...)`.
- Postgres-only operators (`$contArr`, `$intersectsArr`) throw on other SQL dialects.

---

## Example app

A working NestJS app is in [`apps/example-app`](../../apps/example-app).

## License

MIT © Ackplus
