# React

Use [`@ackplus/nest-crud-request`](https://www.npmjs.com/package/@ackplus/nest-crud-request)
to build queries on the client and any HTTP library to send them. New to the query
format? Read the [Querying guide](../querying.md) for the concepts.

```bash
npm install @ackplus/nest-crud-request axios
```

## A typed API client

```ts
// users-api.ts
import axios from 'axios';
import { QueryBuilder, OrderDirectionEnum } from '@ackplus/nest-crud-request';

export interface User {
  id: string;            // UUID string, not a number
  email: string;
  firstName: string;
  createdAt: string;
}
export interface Page<T> { items: T[]; total: number }

const http = axios.create({ baseURL: import.meta.env.VITE_API_URL }); // e.g. http://localhost:3000

export const usersApi = {
  list(opts: { page: number; pageSize: number; search?: string }): Promise<Page<User>> {
    const qb = new QueryBuilder()
      .addOrder('createdAt', OrderDirectionEnum.DESC)
      .setTake(opts.pageSize)
      .setSkip((opts.page - 1) * opts.pageSize);
    if (opts.search) qb.where('firstName', '$iLike', `%${opts.search}%`);
    // toObject() serialises where/relations/order to JSON strings for the query string
    return http.get('/users', { params: qb.toObject() }).then((r) => r.data);
  },
  get: (id: string) => http.get<User>(`/users/${id}`).then((r) => r.data),
  create: (body: Partial<User>) => http.post<User>('/users', body).then((r) => r.data),
  update: (id: string, body: Partial<User>) => http.put<User>(`/users/${id}`, body).then((r) => r.data), // PUT, not PATCH
  remove: (id: string) => http.delete<{ success: boolean; message: string }>(`/users/${id}`).then((r) => r.data),
};
```

## A list hook with pagination + search

```tsx
import { useEffect, useState } from 'react';
import { usersApi, User } from './users-api';

export function useUsers(page: number, pageSize = 20, search = '') {
  const [data, setData] = useState<{ items: User[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    usersApi.list({ page, pageSize, search })
      .then((res) => active && setData(res))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [page, pageSize, search]);

  return { items: data.items, total: data.total, loading };
}
```

```tsx
function UsersTable() {
  const [page, setPage] = useState(1);
  const { items, total, loading } = useUsers(page);
  const pages = Math.ceil(total / 20);
  // render items, then page controls using `total` / `pages`
}
```

## Contract reminders

- The list endpoint returns **`{ items, total }`**, not a bare array — use `total` for pagination.
- Update is **`PUT /:id`** (not `PATCH`).
- Ids are **UUID strings**.
- There's **no `/api` prefix** unless you add `app.setGlobalPrefix('api')` yourself.
- `react-query`/`swr` work great — wrap `usersApi.*` in your query/mutation functions.

## Links

- 📦 [`@ackplus/nest-crud-request`](https://www.npmjs.com/package/@ackplus/nest-crud-request) (npm) ·
  [source](https://github.com/ack-solutions/nest-crud/tree/main/packages/nest-crud-request)
- 📖 [Querying guide](../querying.md) — every operator, relations, aggregates, `having`
- 🧩 [All packages & links](../packages.md)
- Other clients: [Angular](./angular.md) · [Vue](./vue.md) · [Flutter / Dart](./flutter.md)
