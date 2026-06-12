import {
    DynamicModule,
    Inject,
    MiddlewareConsumer,
    Module,
    NestModule,
    Optional,
    RequestMethod,
} from '@nestjs/common';
import { crudMethodOverride, CrudMethodOverrideOptions } from './method-override.middleware';

const OPTIONS_TOKEN = 'CRUD_METHOD_OVERRIDE_OPTIONS';

/**
 * Drop-in module that enables {@link crudMethodOverride} for every route.
 *
 * ```ts
 * import { CrudMethodOverrideModule } from '@ackplus/nest-crud';
 *
 * @Module({ imports: [CrudMethodOverrideModule.forRoot()] })
 * export class AppModule {}
 * ```
 *
 * Wiring it as Nest middleware (instead of `app.use()` in `main.ts`) is deliberate:
 * Nest runs route middleware **after** the body parser — so `req.body` is populated
 * and can be converted into the query — and **before** the router, so the rewritten
 * method still reaches the `@Get()` handler. (`app.use()` in `main.ts` runs *before*
 * the body parser, so the body wouldn't be available yet.)
 */
@Module({})
export class CrudMethodOverrideModule implements NestModule {
    constructor(
        @Optional() @Inject(OPTIONS_TOKEN) private readonly options: CrudMethodOverrideOptions = {},
    ) {}

    /** Configure the override (custom headers / body keys / allowed verbs). */
    static forRoot(options: CrudMethodOverrideOptions = {}): DynamicModule {
        return {
            module: CrudMethodOverrideModule,
            providers: [{ provide: OPTIONS_TOKEN, useValue: options }],
        };
    }

    configure(consumer: MiddlewareConsumer): void {
        consumer
            .apply(crudMethodOverride(this.options ?? {}))
            .forRoutes({ path: '*', method: RequestMethod.ALL });
    }
}
