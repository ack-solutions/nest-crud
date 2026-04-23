# Example App

This app is a small working reference for `@ackplus/nest-crud`.

It shows:

- TypeORM entity setup
- `CrudService<T>` extension
- `@Crud()` controllers
- custom endpoints beside generated CRUD routes
- Swagger setup

## Run It

From the repo root:

```bash
pnpm install
pnpm build
pnpm -C apps/example-app start:dev
```

App URLs:

- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/api`

## Files To Read

- [`src/users/user.controller.ts`](./src/users/user.controller.ts)
- [`src/users/user.service.ts`](./src/users/user.service.ts)
- [`src/posts/post.controller.ts`](./src/posts/post.controller.ts)
- [`src/posts/post.service.ts`](./src/posts/post.service.ts)
- [`src/database/entities/user.entity.ts`](./src/database/entities/user.entity.ts)
- [`src/database/entities/post.entity.ts`](./src/database/entities/post.entity.ts)

## Notes

- The example app uses workspace packages from this repo.
- Some custom endpoints in the example app are handwritten in addition to the generated CRUD endpoints.
- Treat the package READMEs as the main docs and this app as a runnable reference.
- Some controller files in the example app predate the current recommended `@Crud({ path: ... })` pattern. Follow the package README for canonical setup.
