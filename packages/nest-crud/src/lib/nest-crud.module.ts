import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CrudOptions } from './interface/crud';
import { CrudConfigService } from './service/crud-config.service';


@Module({
    imports: [TypeOrmModule],
    controllers: [],
    providers: [],
    exports: [],
})
export class NestCrudModule {
    /**
     * Register global CRUD defaults, merged into every `@Crud()` controller.
     * Use for app-wide settings like `maxPageSize`, i18n `messages`, or route
     * path/enabled overrides:
     *
     * ```ts
     * @Module({
     *   imports: [NestCrudModule.forRoot({ maxPageSize: 100 })],
     * })
     * export class AppModule {}
     * ```
     *
     * Equivalent to calling `CrudConfigService.load(config)` once at startup.
     * Per-controller `@Crud({ ... })` options still override these defaults.
     */
    static forRoot(config: Partial<CrudOptions> = {}): DynamicModule {
        CrudConfigService.load(config);
        return {
            module: NestCrudModule,
        };
    }
}
