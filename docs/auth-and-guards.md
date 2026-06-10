# Auth & guards

## Protect specific routes

Attach guards (and interceptors / extra decorators) per route through the `routes`
config. They run exactly like guards applied with `@UseGuards`.

```ts
@Crud({
  entity: Post,
  path: 'posts',
  routes: {
    findMany: { enabled: true },                       // public
    findOne:  { enabled: true },                       // public
    create:   { enabled: true, guards: [JwtAuthGuard] },
    update:   { enabled: true, guards: [JwtAuthGuard, OwnerGuard] },
    delete:   { enabled: true, guards: [JwtAuthGuard, AdminGuard] },
  },
})
export class PostController {
  constructor(public service: PostService) {}
}
```

If a route is overridden by a method you define, your `@UseGuards` decorators are
merged with the ones from the route config.

## Apply a guard to the whole controller

Use NestJS's normal mechanisms — `@UseGuards(JwtAuthGuard)` on the controller
class, or a module/global guard:

```ts
@UseGuards(JwtAuthGuard)
@Crud({ entity: Post, path: 'posts', routes: { /* … */ } })
export class PostController {
  constructor(public service: PostService) {}
}
```

## Knowing which action ran (interceptors)

`getAction(handler)` returns the CRUD action name for the current handler, which
is handy inside an interceptor for auditing or fine-grained authorisation.

```ts
import { getAction } from '@ackplus/nest-crud';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const action = getAction(context.getHandler()); // e.g. 'create', 'delete'
    // record who did what…
    return next.handle();
  }
}
```

For row-level rules (e.g. "users can only read their own records"), prefer a
[lifecycle hook](./lifecycle-hooks.md) (`beforeFindMany` / `beforeFindOne`) so the
constraint is enforced in the query itself.
