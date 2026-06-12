# Getting started

This guide takes you from an empty NestJS project to working, documented CRUD
endpoints in a few minutes.

## 1. Install

```bash
npm install @ackplus/nest-crud
# peer dependencies (if not already installed)
npm install @nestjs/common @nestjs/core @nestjs/platform-express \
  @nestjs/swagger @nestjs/typeorm typeorm class-validator class-transformer \
  reflect-metadata
```

`@ackplus/nest-crud` declares these as **peer** dependencies so it uses the same
NestJS/TypeORM versions as your app. It supports NestJS 10 and 11.

## 2. Define an entity

Extend `BaseEntity` to get a UUID `id` plus `createdAt`, `updatedAt`, and a
`deletedAt` soft-delete column.

```ts
import { Entity, Column } from 'typeorm';
import { BaseEntity } from '@ackplus/nest-crud';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column()
  firstName: string;

  @Column({ default: true })
  isActive: boolean;
}
```

> The service assumes the primary key `id` is provided by `BaseEntity`. If you
> need an ordered list, extend `BaseEntityWithOrder` instead (adds an `order` column).

## 3. Create a service

Extend `CrudService<T>` and inject the entity repository.

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '@ackplus/nest-crud';
import { User } from './user.entity';

@Injectable()
export class UserService extends CrudService<User> {
  constructor(
    @InjectRepository(User)
    public repository: Repository<User>,
  ) {
    super(repository);
  }
}
```

## 4. Create a controller

Apply `@Crud()`. **It already applies `@Controller(path)` for you — do not add a
second `@Controller()`.** The controller must expose the service as a property
named `service`.

```ts
import { ApiTags } from '@nestjs/swagger';
import { Crud } from '@ackplus/nest-crud';
import { User } from './user.entity';
import { UserService } from './user.service';

@ApiTags('users')
@Crud({
  entity: User,
  path: 'users',
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
```

> ⚠️ Routes use the **object form** `{ enabled: true }`. The shorthand
> `findMany: true` also works. Routes you don't list are enabled by default — to
> expose only a subset, disable the rest with `{ enabled: false }`.

## 5. Wire up the module

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
```

And a root module with a database connection:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserModule } from './user.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres', // or mysql, sqlite, ...
      url: process.env.DATABASE_URL,
      entities: [User],
      synchronize: true, // dev only
    }),
    UserModule,
  ],
})
export class AppModule {}
```

## 6. Enable Swagger (optional but recommended)

```ts
// main.ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder().setTitle('My API').setVersion('1.0').build();
  SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, config));

  await app.listen(3000);
}
bootstrap();
```

Open `http://localhost:3000/api` — every generated route is documented, including
filter operators, relations, pagination, and request/response schemas.

## 7. Make your first requests

```bash
# Create
curl -X POST localhost:3000/users -H 'content-type: application/json' \
  -d '{"email":"jane@example.com","firstName":"Jane"}'

# List — returns { items, total }
curl 'localhost:3000/users'

# Get one
curl localhost:3000/users/<id>

# Update (PUT, not PATCH)
curl -X PUT localhost:3000/users/<id> -H 'content-type: application/json' \
  -d '{"firstName":"Janet"}'

# Delete
curl -X DELETE localhost:3000/users/<id>
```

## Things to know up front

- `GET /resource` is `findMany` and returns `{ items, total }`.
- `GET /resource/get/all` is `findAll` and returns a bare array `T[]`.
- Update is **`PUT /:id`**, not `PATCH`.
- Soft-delete routes (`/:id/restore`, `/:id/trash`, `/restore/bulk`, `/trash/bulk`)
  only exist when you pass `softDelete: true` to `@Crud()`.
- List queries are capped by `maxPerPage` (default 5000).
- The query layer ships **29 filter operators**, relations, multi-sort, and
  **aggregates** (`count`/`sum`/`avg`/`min`/`max` over relations with `having`) — see
  [Querying](./querying.md).
- Lock down sensitive columns with [`@CrudHidden()`](./querying.md#hiding-sensitive-fields)
  so they can never be selected, filtered, or sorted by clients.

## Talking to your API from a client

You don't have to build the JSON query strings by hand. The query builders produce
the exact wire format the server expects, on any platform:

- **JS / TS** (React, Angular, Vue, Node): [`@ackplus/nest-crud-request`](https://www.npmjs.com/package/@ackplus/nest-crud-request)
- **Flutter / Dart**: [`nest_crud_request`](https://pub.dev/packages/nest_crud_request)

See [Packages & links](./packages.md) for all three, and the framework guides below.

## Next

- [Querying](./querying.md) — filters, relations, pagination, sorting, aggregates, counts.
- [Configuration](./configuration.md) — every `@Crud()` option.
- [Lifecycle hooks](./lifecycle-hooks.md) — `beforeCreate`, `beforeFindMany`, …
- [Auth & guards](./auth-and-guards.md) — protect routes and hide sensitive columns.
- [Packages & links](./packages.md) — the client query builders (JS + Flutter/Dart).
- Client guides: [React](./frameworks/react.md) · [Angular](./frameworks/angular.md) ·
  [Vue](./frameworks/vue.md) · [Flutter / Dart](./frameworks/flutter.md).
- [Error handling](./error-handling.md) · [Troubleshooting](./troubleshooting.md).
