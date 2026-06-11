# @ackplus/nest-crud — Example API

A runnable NestJS app that demonstrates **every** feature of `@ackplus/nest-crud`
against seeded data, so you can try things immediately in **Swagger** or **Postman**.

## Run it

```bash
# from the repo root (builds the libraries first)
pnpm install
pnpm -C packages/nest-crud build

# start the example (in-memory SQLite, seeds on boot)
pnpm -C apps/example-app start          # or: start:dev for watch mode
```

- API: <http://localhost:3000>  ·  Swagger UI: <http://localhost:3000/api>
- Change the port with `PORT=3100`. Persist data with `DATABASE_PATH=./db.sqlite`.

Every list endpoint documents its query params (`where`, `relations`, `order`,
`select`, `aggregates`, `having`, `take`, `skip`, `withDeleted`, `onlyDeleted`)
**with copy-paste examples** — open `GET /users` in Swagger and hit *Try it out*.

## The domain (covers every relation + hidden kind)

| Entity | Relations | Hidden |
| --- | --- | --- |
| **User** | `profile` (1:1), `posts` (1:n), `auditLogs` (1:n) | `password` (column), `auditLogs` (relation) |
| **Profile** | `addresses` (1:n), `user` (1:1) | — |
| **Post** | `author` (n:1), `comments` (1:n) | `internalNotes` (column) |
| **Comment** | `post` (n:1) | — |

Seeded users: **John** (admin, 3 posts), **Jane** (user, 1 post), **Bob**
(moderator, 2 posts, inactive), **Alice** (user, 0 posts).

## Example requests

> Paste the value after `=` into the matching field in Swagger, or use the `curl`
> form below (`--data-urlencode` handles the encoding).

### Filtering (`where`)

```bash
# equals + comparison
curl -G localhost:3000/users --data-urlencode 'where={"role":"admin","age":{"$gte":30}}'
# OR / AND
curl -G localhost:3000/users --data-urlencode 'where={"$or":[{"role":"admin"},{"role":"moderator"}]}'
# case-insensitive search
curl -G localhost:3000/users --data-urlencode 'where={"firstName":{"$iLike":"%jo%"}}'
# IN
curl -G localhost:3000/users --data-urlencode 'where={"role":{"$in":["user","moderator"]}}'
# BETWEEN (on posts)
curl -G localhost:3000/posts --data-urlencode 'where={"likes":{"$between":[10,30]}}'
# relation existence (no join)
curl -G localhost:3000/users --data-urlencode 'where={"posts":{"$exists":true}}'
curl -G localhost:3000/users --data-urlencode 'where={"posts":{"$notExists":true}}'   # -> Alice
```

### Relations (`relations`)

```bash
# nested relations
curl -G localhost:3000/users --data-urlencode 'relations=["profile.addresses","posts.comments"]'
# object form: pick columns + inner join + relation-scoped where
curl -G localhost:3000/users --data-urlencode 'relations=[{"posts":{"select":["title"],"where":{"status":"published"},"joinType":"inner"}}]'
```

### Select & sort

```bash
curl -G localhost:3000/users --data-urlencode 'select=["id","firstName","email"]'
curl -G localhost:3000/users --data-urlencode 'order={"age":"DESC"}'
```

### Aggregates & HAVING

```bash
# count + sum over the posts relation, sorted by the alias
curl -G localhost:3000/users \
  --data-urlencode 'aggregates=[{"fn":"count","field":"posts.id","as":"postCount"},{"fn":"sum","field":"posts.likes","as":"likes"}]' \
  --data-urlencode 'order={"postCount":"DESC"}'
# -> John(3,47) Bob(2,23) Jane(1,20) Alice(0,0)

# keep only prolific authors
curl -G localhost:3000/users \
  --data-urlencode 'aggregates=[{"fn":"count","field":"posts.id","as":"postCount"}]' \
  --data-urlencode 'having={"postCount":{"$gt":1}}'      # -> John, Bob (total 2)
```

### Hidden fields & relations (security)

```bash
curl -G localhost:3000/users --data-urlencode 'select=["email","password"]'    # password silently dropped
curl -G localhost:3000/users --data-urlencode 'where={"password":{"$eq":"x"}}' # 400
curl -G localhost:3000/users --data-urlencode 'relations=["auditLogs"]'        # 400 (hidden relation)
```

### Pagination & counts

```bash
curl -G localhost:3000/users --data-urlencode 'take=2' --data-urlencode 'skip=1' --data-urlencode 'order={"age":"DESC"}'
curl -G 'localhost:3000/users/get/counts' --data-urlencode 'groupByKey=role'
curl localhost:3000/users/get/all          # findAll (no pagination envelope)
```

### Soft-delete / trash / restore (Users have `softDelete: true`)

```bash
ID=...                                          # an id from GET /users
curl -X DELETE localhost:3000/users/$ID         # soft-delete (sets deletedAt)
curl -G localhost:3000/users --data-urlencode 'onlyDeleted=true'    # trash list
curl -G localhost:3000/users --data-urlencode 'withDeleted=true'    # live + deleted
curl -X PUT localhost:3000/users/$ID/restore    # restore
```

### Bulk

```bash
curl -X POST localhost:3000/users/bulk -H 'content-type: application/json' \
  -d '{"bulk":[{"email":"x@e.com","firstName":"X","lastName":"Y","password":"p","age":40}]}'
```

## Build requests on the client

The same requests can be built type-safely with
[`@ackplus/nest-crud-request`](../../packages/nest-crud-request/README.md):

```ts
import { QueryBuilder, AggregateFnEnum, WhereOperatorEnum, OrderDirectionEnum } from '@ackplus/nest-crud-request';

const params = new QueryBuilder()
  .where('role', 'admin')
  .addRelation('posts', ['title'], undefined, 'inner')
  .addAggregate({ fn: AggregateFnEnum.COUNT, field: 'posts.id', as: 'postCount' })
  .having('postCount', WhereOperatorEnum.GT, 1)
  .addOrder('postCount', OrderDirectionEnum.DESC)
  .toObject();

await axios.get('/users', { params });
```

## Tests

```bash
# smoke e2e over in-memory SQLite (always runs, no setup)
pnpm -C apps/example-app test:e2e
```

### End-to-end against real Postgres

`test/postgres.e2e-spec.ts` exercises the full stack on a real Postgres DB —
create (via bulk), find, filter, operators (`$iLike` / `$isTrue` / `$isFalse`),
nested relations, aggregates + having, counts, hidden field/relation rejection,
update, **soft-delete → trash → restore**, **bulk** update/delete, and **reorder**.

It is **opt-in** — it only runs when a Postgres target is configured (otherwise
it's skipped), so it never breaks machines/CI without a database. Point it at any
Postgres via env vars (or `DATABASE_URL`); it creates and TRUNCATEs only its own
tables.

```bash
# 1. a throwaway Postgres (or use your own)
docker run -d --name pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=nest_crud_e2e -p 5432:5432 postgres:16-alpine

# 2. build the lib, then run the e2e against it
pnpm -C packages/nest-crud build
DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=nest_crud_e2e \
  pnpm -C apps/example-app test:e2e

# (or a single connection string)
DATABASE_URL=postgres://postgres:postgres@localhost:5432/nest_crud_e2e \
  pnpm -C apps/example-app test:e2e
```

See the [docs site](https://ack-solutions.github.io/nest-crud/) for the full guide.
