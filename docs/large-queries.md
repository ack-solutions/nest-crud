# Large queries (method override)

All read routes — `findMany`, `findOne`, `counts`, `findAll` — are **GET**, with the
filter (`where`, `relations`, `select`, `order`, `aggregates`, `having`) carried as
JSON in the query string. That's the right default: GET reads are idempotent and
cacheable.

But a URL has a ceiling. The binding limit is usually a **proxy or CDN**, not the
browser:

| Layer | URL limit | On exceed |
| --- | --- | --- |
| nginx (`large_client_header_buffers 4 8k`) | ~8 KB | `414` |
| Apache (`LimitRequestLine`) | ~8 KB | `414` |
| AWS CloudFront | 8192 bytes | `414` |
| Node.js (`maxHeaderSize`) | 16 KB | `431` |

URL-encoding inflates JSON ~2× (`{`, `"`, `:` → `%7B`, `%22`, `%3A`), so a big filter —
a `$in` with hundreds of IDs, or a saved dashboard with many conditions — can hit
`414 Request-URI Too Large`. **Keep under ~2 KB to be safe everywhere; risk starts ~8 KB.**

## The fix: send the big query as a POST, handled as a GET

The method stays GET. For the **rare** large query, the client sends a **POST** with
the query in the **body** plus an override marker. A middleware turns it back into a
GET, so the **same handler and the same parser** run — the result is **identical** to
a direct GET. No second route, no API change.

```
GET  /users?where=…                         ← normal (cacheable)
POST /users   + X-HTTP-Method-Override: GET  ← same query, in the body, when it's too long
     body: { "where": "…", "take": 20 }
```

---

## Backend — enable it once

Import `CrudMethodOverrideModule` in your root module:

```ts
import { Module } from '@nestjs/common';
import { CrudMethodOverrideModule } from '@ackplus/nest-crud';

@Module({
  imports: [
    CrudMethodOverrideModule.forRoot(),
    // …your feature modules
  ],
})
export class AppModule {}
```

That's the only backend change. Now any read can also be sent as a POST-override.

::: tip Why a module and not `app.use()` in main.ts?
The middleware needs `req.body` (to turn it into the query). Nest runs **route
middleware after the body parser and before the router** — so the body is available
*and* the rewritten method still reaches the `@Get()` handler. `app.use()` in
`main.ts` runs **before** the body parser, so the body wouldn't be parsed yet.
:::

### Options

```ts
CrudMethodOverrideModule.forRoot({
  headers: ['x-http-method-override', 'x-method-override'], // header names checked
  bodyKeys: ['_method'],                                    // body keys checked + stripped
  allowedMethods: ['GET'],                                  // only safe verbs (default)
});
```

- **Safe by default:** only `GET` is an allowed target, so the override can never be
  used to reach a write route. A genuine `POST` create / `PUT` update (no marker) is
  passed through untouched.
- **Body size:** the query now travels in the body, bounded by your JSON body limit
  (Nest default **100 KB**). If you expect very large queries, raise it — but not too
  high, or you widen your DoS surface:
  ```ts
  const app = await NestFactory.create(AppModule);
  app.useBodyParser('json', { limit: '512kb' });
  ```

### Using the raw middleware instead

If you wire middleware yourself, the factory is also exported:

```ts
import { crudMethodOverride } from '@ackplus/nest-crud';

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(crudMethodOverride()).forRoutes('*'); // after the body parser
  }
}
```

---

## Frontend — send big queries via the body

Nothing changes for normal queries. Only switch to the POST form when the query is
large. The body is the **same object** you'd put in the query string — the client
builder's `toObject()` (its values are already JSON strings), which is exactly what
makes the server parse it identically.

### JavaScript / TypeScript (`@ackplus/nest-crud-request`)

```ts
import { QueryBuilder } from '@ackplus/nest-crud-request';

async function list(qb: QueryBuilder) {
  const params = qb.toObject(); // { where: "…", order: "…", take: 20 }
  const urlLength = new URLSearchParams(params as any).toString().length;

  if (urlLength <= 1800) {
    // normal GET — cacheable
    return http.get('/users', { params }).then((r) => r.data);
  }

  // too long → POST the same query, ask the server to treat it as GET
  return http
    .post('/users', params, { headers: { 'X-HTTP-Method-Override': 'GET' } })
    .then((r) => r.data);
}
```

Prefer the body marker instead of the header? Send `{ ...params, _method: 'GET' }` as
the body (the server strips `_method` before parsing).

### Dart / Flutter (`nest_crud_request`)

```dart
Future<Map<String, dynamic>> list(QueryBuilder qb) async {
  final params = qb.toQueryParameters(); // Map<String, String>
  final urlLength = Uri(queryParameters: params).query.length;

  if (urlLength <= 1800) {
    final res = await dio.get('/users', queryParameters: params);
    return res.data;
  }

  final res = await dio.post(
    '/users',
    data: params,
    options: Options(headers: {'X-HTTP-Method-Override': 'GET'}),
  );
  return res.data;
}
```

---

## Guarantees & trade-offs

- **Identical to a direct GET.** The body is merged into `req.query` and parsed by the
  same `RequestQueryParser`, so the response is byte-for-byte the same as the GET form
  (verified by tests).
- **Writes are never affected.** Only `GET` is an allowed override target; a POST
  without a marker stays a POST.
- **No caching on the POST path.** A POST isn't CDN/browser-cached — fine, since large
  ad-hoc filters are usually dynamic anyway. Normal (small) reads stay cacheable GETs.
- **CORS preflight.** The POST carries a custom header, so cross-origin browsers send a
  preflight `OPTIONS` first — one extra round-trip on the rare large query.

## See also

- [Querying](./querying.md) — the full filter syntax that ends up in the body
- [Packages & links](./packages.md) — the client builders that emit `toObject()`
- [Troubleshooting](./troubleshooting.md) — `414` / large-URL symptoms
