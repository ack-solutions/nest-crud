# Vue

Use [`@ackplus/nest-crud-request`](../querying.md) to build queries and any HTTP
library (here, `axios`) to send them.

```bash
npm install @ackplus/nest-crud-request axios
```

## A typed API module

```ts
// users-api.ts
import axios from 'axios';
import { QueryBuilder, OrderDirectionEnum } from '@ackplus/nest-crud-request';

export interface User {
  id: string;            // UUID string
  email: string;
  firstName: string;
  createdAt: string;
}
export interface Page<T> { items: T[]; total: number }

const http = axios.create({ baseURL: import.meta.env.VITE_API_URL });

export const usersApi = {
  list(opts: { page: number; pageSize: number; search?: string }): Promise<Page<User>> {
    const qb = new QueryBuilder()
      .addOrder('createdAt', OrderDirectionEnum.DESC)
      .setTake(opts.pageSize)
      .setSkip((opts.page - 1) * opts.pageSize);
    if (opts.search) qb.where('firstName', '$iLike', `%${opts.search}%`);
    return http.get('/users', { params: qb.toObject() }).then((r) => r.data);
  },
  get: (id: string) => http.get<User>(`/users/${id}`).then((r) => r.data),
  create: (body: Partial<User>) => http.post<User>('/users', body).then((r) => r.data),
  update: (id: string, body: Partial<User>) => http.put<User>(`/users/${id}`, body).then((r) => r.data), // PUT, not PATCH
  remove: (id: string) => http.delete<{ success: boolean; message: string }>(`/users/${id}`).then((r) => r.data),
};
```

## A composable

```ts
// use-users.ts
import { ref, watchEffect } from 'vue';
import { usersApi, User } from './users-api';

export function useUsers(page = ref(1), pageSize = 20) {
  const items = ref<User[]>([]);
  const total = ref(0);
  const loading = ref(false);

  watchEffect(async () => {
    loading.value = true;
    try {
      const res = await usersApi.list({ page: page.value, pageSize });
      items.value = res.items;
      total.value = res.total;
    } finally {
      loading.value = false;
    }
  });

  return { items, total, loading };
}
```

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useUsers } from './use-users';
const page = ref(1);
const { items, total, loading } = useUsers(page);
</script>
```

## Contract reminders

- The list endpoint returns **`{ items, total }`**, not a bare array.
- Update is **`PUT /:id`** (not `PATCH`).
- Ids are **UUID strings**.
- There's **no `/api` prefix** unless you add one.
- With Pinia, store `items` + `total` and page from `total`.
