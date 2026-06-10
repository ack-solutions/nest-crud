# Soft delete

`BaseEntity` includes a `deletedAt` (`@DeleteDateColumn`) column. Pass
`softDelete: true` to `@Crud()` to turn delete operations into **soft** deletes and
to generate the trash / restore routes.

```ts
@Crud({
  entity: User,
  path: 'users',
  softDelete: true,
  routes: {
    delete: { enabled: true },
    restore: { enabled: true },
    deleteFromTrash: { enabled: true },
    restoreMany: { enabled: true },
    deleteFromTrashMany: { enabled: true },
  },
})
export class UserController {
  constructor(public service: UserService) {}
}
```

## Behaviour

- `DELETE /:id` sets `deletedAt` instead of removing the row.
- Soft-deleted rows are hidden from `findMany` / `findOne` by default.
- `GET /?withDeleted=true` includes them; `GET /?onlyDeleted=true` returns only them.
- `PUT /:id/restore` clears `deletedAt` (un-trashes).
- `DELETE /:id/trash` permanently removes a (soft-deleted) row.
- Bulk variants: `PUT /restore/bulk` (body `{ ids }`),
  `DELETE /trash/bulk?ids=…`.

```bash
curl -X DELETE localhost:3000/users/<id>            # soft delete
curl 'localhost:3000/users?onlyDeleted=true'        # list trash
curl -X PUT localhost:3000/users/<id>/restore       # restore
curl -X DELETE localhost:3000/users/<id>/trash      # permanent delete
```

See [querying.md](./querying.md#soft-delete) for the `withDeleted` / `onlyDeleted`
flags on read endpoints.
