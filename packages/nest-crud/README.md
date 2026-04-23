# @ackplus/nest-crud

`@ackplus/nest-crud` generates CRUD routes for NestJS + TypeORM. It gives you a `@Crud()` decorator, a reusable `CrudService<T>`, request-query parsing, Swagger metadata, and helpers for custom query reuse.

## What It Does

Use this package when you want:

- fast CRUD setup for a TypeORM entity
- one request format for filters, relations, select, sorting, and pagination
- service hooks instead of rewriting CRUD logic
- custom endpoints beside generated CRUD routes

## Installation

```bash
npm install @ackplus/nest-crud
npm install @nestjs/common @nestjs/core @nestjs/platform-express @nestjs/swagger @nestjs/typeorm typeorm class-validator class-transformer reflect-metadata
```

Declared peer ranges:

- `@nestjs/common`: `^10 || ^11`
- `@nestjs/core`: `^10 || ^11`
- `@nestjs/platform-express`: `^10 || ^11`
- `@nestjs/swagger`: `^10 || ^11`
- `@nestjs/typeorm`: `^10 || ^11`
- `typeorm`: `^0.3.21`

## Optional Companion Package For Requests

If you do not want to build request query params manually, this repo also provides:

```bash
npm install @ackplus/nest-crud-request
```

That package helps build:

- `where`
- `relations`
- `select`
- `order`
- `take`
- `skip`
- `withDeleted`
- `onlyDeleted`

Example:

```ts
import { QueryBuilder, WhereOperatorEnum, OrderDirectionEnum } from '@ackplus/nest-crud-request';

const params = new QueryBuilder()
  .where('isActive', WhereOperatorEnum.EQ, true)
  .addRelation('posts', ['id', 'title'])
  .addOrder('createdAt', OrderDirectionEnum.DESC)
  .setTake(10)
  .setSkip(0)
  .toObject();
```

See [`../nest-crud-request/README.md`](../nest-crud-request/README.md) for the full request-builder documentation.

## Quick Start

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
  constructor(
    @InjectRepository(User) public repository: Repository<User>,
  ) {
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

Generated endpoints:

- `GET /users` -> `{ items, total }`
- `GET /users/:id`
- `POST /users`
- `PUT /users/:id`
- `DELETE /users/:id`

## Main Concepts

## `@Crud()`

`@Crud()` is the controller decorator for this package. It:

- applies `@Controller(...)`
- generates route handlers when they do not exist
- applies Swagger metadata
- applies validation metadata
- attaches route-level guards, interceptors, and custom decorators

Recommended pattern:

```ts
@Crud({
  path: 'users',
  entity: User,
  routes: {
    findMany: { enabled: true },
  },
})
```

Use `path` inside `@Crud()`. Do not stack a separate `@Controller()` unless you want to override the path yourself.

## `CrudService<T>`

`CrudService<T>` is the runtime implementation behind generated routes. Extend it in your service and pass the TypeORM repository into `super(repository)`.

Main methods:

| Method | Purpose |
| --- | --- |
| `findMany(query, crudOptions?)` | paginated list, returns `{ items, total }` |
| `findAll(query, crudOptions?)` | plain array list, returns `T[]` |
| `counts(request, crudOptions?)` | count or grouped count |
| `findOne(id, query?)` | fetch one entity |
| `create(data)` | create one entity |
| `createMany({ bulk })` | create many entities |
| `update(idOrWhere, data)` | update one entity |
| `updateMany({ bulk })` | update many entities |
| `delete(idOrWhere, softDelete?)` | hard or soft delete one |
| `deleteMany({ ids }, softDelete?)` | hard or soft delete many |
| `restore(idOrWhere)` | restore one soft-deleted record |
| `restoreMany({ ids })` | restore many soft-deleted records |
| `deleteFromTrash(idOrWhere)` | hard delete one trashed record |
| `deleteFromTrashMany({ ids })` | hard delete many trashed records |
| `reorder(ids)` | update an `order` column using array order |

## Generated Routes

These are the default route definitions from the package:

| Action | Method | Default path |
| --- | --- | --- |
| `findAll` | `GET` | `/get/all` |
| `findMany` | `GET` | `/` |
| `counts` | `GET` | `/get/counts` |
| `findOne` | `GET` | `/:id` |
| `create` | `POST` | `/` |
| `createMany` | `POST` | `/bulk` |
| `update` | `PUT` | `/:id` |
| `updateMany` | `PUT` | `/bulk` |
| `delete` | `DELETE` | `/:id` |
| `deleteMany` | `DELETE` | `/delete/bulk` |
| `deleteFromTrash` | `DELETE` | `/:id/trash` |
| `deleteFromTrashMany` | `DELETE` | `/trash/bulk` |
| `restore` | `PUT` | `/:id/restore` |
| `restoreMany` | `PUT` | `/restore/bulk` |
| `reorder` | `PUT` | `/reorder` |

Soft-delete restore and trash routes are only created when `softDelete: true` is enabled.

## Route Configuration

Each route supports:

- `enabled`
- `path`
- `method`
- `guards`
- `interceptors`
- `decorators`

Recommended form:

```ts
routes: {
  findMany: {
    enabled: true,
    guards: [AuthGuard],
  },
  createMany: {
    enabled: false,
  },
}
```

Use explicit route objects. The exported types allow boolean flags, but the runtime merge logic is safest with object configs.

## Request Query Format

The backend parser accepts these top-level query parameters:

- `where`
- `relations`
- `select`
- `order`
- `skip` or `offset`
- `take` or `limit`
- `withDeleted`
- `onlyDeleted`

Example:

```http
GET /users?where={"isActive":{"$eq":true}}&relations={"posts":{"select":["id","title"]}}&order={"createdAt":"DESC"}&take=10&skip=0
```

Supported formats:

- JSON strings
- nested objects
- bracket notation such as `where[status][$eq]=active`

## How To Send Requests Without `@ackplus/nest-crud-request`

You can call the API directly without the request-builder package.

The common rule is:

- send `where`, `relations`, `select`, and `order` as JSON strings
- send `take`, `skip`, `limit`, `offset`, `withDeleted`, and `onlyDeleted` as normal query params

### Direct URL Example

```http
GET /users?where={"isActive":{"$eq":true}}&relations={"posts":{"select":["id","title"]}}&select=["id","email","firstName"]&order={"createdAt":"DESC"}&take=10&skip=0
```

### `fetch` Example

```ts
const params = new URLSearchParams({
  where: JSON.stringify({
    isActive: { $eq: true },
  }),
  relations: JSON.stringify({
    posts: {
      select: ['id', 'title'],
    },
  }),
  select: JSON.stringify(['id', 'email', 'firstName']),
  order: JSON.stringify({
    createdAt: 'DESC',
  }),
  take: '10',
  skip: '0',
});

const response = await fetch(`/users?${params.toString()}`);
const data = await response.json();
```

### `axios` Example

```ts
const response = await axios.get('/users', {
  params: {
    where: JSON.stringify({
      role: { $in: ['admin', 'moderator'] },
    }),
    order: JSON.stringify({
      createdAt: 'DESC',
    }),
    take: 20,
    skip: 0,
  },
});
```

### `curl` Example

```bash
curl -G http://localhost:3000/users \
  --data-urlencode 'where={"isActive":{"$eq":true}}' \
  --data-urlencode 'relations={"posts":{"select":["id","title"]}}' \
  --data-urlencode 'order={"createdAt":"DESC"}' \
  --data-urlencode 'take=10' \
  --data-urlencode 'skip=0'
```

### Bracket-Notation Example

This also works if your client or API tool prefers nested query params instead of JSON strings:

```http
GET /users?where[isActive][$eq]=true&order[createdAt]=DESC&take=10&skip=0
```

### Request Body Examples

Create:

```http
POST /users
Content-Type: application/json

{
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe"
}
```

Update:

```http
PUT /users/123
Content-Type: application/json

{
  "firstName": "Jane"
}
```

Bulk create:

```http
POST /users/bulk
Content-Type: application/json

{
  "bulk": [
    {
      "email": "a@example.com",
      "firstName": "Alice",
      "lastName": "One"
    },
    {
      "email": "b@example.com",
      "firstName": "Bob",
      "lastName": "Two"
    }
  ]
}
```

Bulk update:

```http
PUT /users/bulk
Content-Type: application/json

{
  "bulk": [
    {
      "id": "123",
      "firstName": "Alice Updated"
    },
    {
      "id": "456",
      "firstName": "Bob Updated"
    }
  ]
}
```

Bulk delete:

```http
DELETE /users/delete/bulk?ids=123&ids=456
```

Restore many with soft delete enabled:

```http
PUT /users/restore/bulk
Content-Type: application/json

{
  "ids": ["123", "456"]
}
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

## Relations, Select, Sorting, Pagination

Examples:

```http
GET /users?relations=["posts"]
GET /users?relations={"posts":{"select":["id","title"]}}
GET /users?relations={"posts":{"where":{"published":{"$eq":true}}}}
GET /users?select=["id","email","firstName"]
GET /users?order={"createdAt":"DESC","email":"ASC"}
GET /users?take=20&skip=40
GET /users?withDeleted=true
```

Notes:

- `findMany()` returns `{ items, total }`
- `findAll()` returns `T[]`
- list routes enforce `maxPerPage`
- `findAll()` removes `skip`
- `counts()` removes pagination fields before counting

## DTOs And Validation

You can pass DTO classes for create and update:

```ts
@Crud({
  path: 'users',
  entity: User,
  dto: {
    create: CreateUserDto,
    update: UpdateUserDto,
  },
})
```

This affects:

- request body typing
- validation
- Swagger request models

## Service Hooks

Override hooks in your service when you need custom behavior:

- `beforeSave`
- `afterSave`
- `beforeCreate` / `afterCreate`
- `beforeUpdate` / `afterUpdate`
- `beforeFindMany`
- `beforeCounts`
- `beforeFindOne`
- `beforeDelete` / `afterDelete`
- `beforeDeleteMany` / `afterDeleteMany`
- `beforeRestore` / `afterRestore`

Example:

```ts
protected async beforeSave(entity: Partial<User>) {
  if (entity.email) {
    entity.email = entity.email.trim().toLowerCase();
  }
  return entity;
}
```

## Override Generated Routes

If you define a controller method with the same name as a CRUD action, the package keeps your method and still applies route metadata.

```ts
import { Query } from '@nestjs/common';
import { CRUD_OPTIONS_METADATA, RequestQueryParser } from '@ackplus/nest-crud';

@Crud({
  path: 'users',
  entity: User,
  routes: {
    findMany: { enabled: true },
  },
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

Do not add `@Get()`, `@Post()`, and similar route decorators to that override method. `@Crud()` sets the route metadata.

## Other Useful Exports

- `CrudConfigService.load()` for global defaults
- `FindQueryBuilder` for custom endpoints that still use the package query format
- `RequestQueryParser` for normalizing raw query params
- `BaseEntity` with `id`, `createdAt`, `updatedAt`, and `deletedAt`
- `BaseEntityWithOrder` with an additional `order` column
- `getAction(handler)` to read CRUD action metadata in interceptors

## Known Limitations

These are real current constraints from the codebase:

- primary key handling assumes the field is named `id`
- `reorder()` expects an array of ids, while the generated DTO shape is awkward for direct HTTP use
- `deleteMany()` currently works with `ids`, not a `where` delete contract
- some exported `CrudOptions` fields are present in types but not cleanly implemented as public features, so they are intentionally not documented here

## Example App

See [`../../apps/example-app`](../../apps/example-app) for a working NestJS app using this package.
