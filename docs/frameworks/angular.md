# Angular

Use [`@ackplus/nest-crud-request`](https://www.npmjs.com/package/@ackplus/nest-crud-request)
to build queries and Angular's `HttpClient` to send them. New to the query format?
Read the [Querying guide](../querying.md) for the concepts.

```bash
npm install @ackplus/nest-crud-request
```

## A typed service

```ts
// users.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { QueryBuilder, OrderDirectionEnum } from '@ackplus/nest-crud-request';

export interface User {
  id: string;            // UUID string
  email: string;
  firstName: string;
  createdAt: string;
}
export interface Page<T> { items: T[]; total: number }

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly base = '/users';

  constructor(private http: HttpClient) {}

  list(opts: { page: number; pageSize: number; search?: string }): Observable<Page<User>> {
    const qb = new QueryBuilder()
      .addOrder('createdAt', OrderDirectionEnum.DESC)
      .setTake(opts.pageSize)
      .setSkip((opts.page - 1) * opts.pageSize);
    if (opts.search) qb.where('firstName', '$iLike', `%${opts.search}%`);
    // toObject() returns serialised params suitable for HttpParams
    return this.http.get<Page<User>>(this.base, { params: qb.toObject() as any });
  }

  get(id: string): Observable<User> { return this.http.get<User>(`${this.base}/${id}`); }
  create(body: Partial<User>): Observable<User> { return this.http.post<User>(this.base, body); }
  update(id: string, body: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.base}/${id}`, body); // PUT, not PATCH
  }
  remove(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.base}/${id}`);
  }
}
```

## Using it in a component

```ts
export class UsersComponent {
  page = 1;
  pageSize = 20;
  total = 0;
  users: User[] = [];

  constructor(private users$: UsersService) {}

  load() {
    this.users$.list({ page: this.page, pageSize: this.pageSize }).subscribe((res) => {
      this.users = res.items;
      this.total = res.total; // drive your paginator from `total`
    });
  }
}
```

## Contract reminders

- The list endpoint returns **`{ items, total }`**, not a bare array.
- Update is **`PUT /:id`** (not `PATCH`).
- Ids are **UUID strings** — don't type them as `number`.
- There's **no `/api` prefix** unless you add one.
- For NgRx, dispatch from `UsersService.*`; the `{ items, total }` shape maps cleanly to a paginated entity state.

## Links

- 📦 [`@ackplus/nest-crud-request`](https://www.npmjs.com/package/@ackplus/nest-crud-request) (npm) ·
  [source](https://github.com/ack-solutions/nest-crud/tree/main/packages/nest-crud-request)
- 📖 [Querying guide](../querying.md) — every operator, relations, aggregates, `having`
- 🧩 [All packages & links](../packages.md)
- Other clients: [React](./react.md) · [Vue](./vue.md) · [Flutter / Dart](./flutter.md)
