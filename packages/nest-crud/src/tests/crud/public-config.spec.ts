import { CrudConfigService, NestCrudModule } from '../../index';

/**
 * Guards the public-config entrypoint. `CrudConfigService` (the documented way to set
 * global defaults like `maxPageSize` / i18n `messages`) must be reachable from the
 * package barrel, and `NestCrudModule.forRoot(config)` is the idiomatic wrapper.
 * Importing from `../../index` (not `../../lib/...`) is the point: it fails if the
 * symbol isn't re-exported.
 */
describe('Public config API — barrel export + NestCrudModule.forRoot', () => {
    let original: typeof CrudConfigService.config;

    beforeEach(() => {
        original = CrudConfigService.config;
    });
    afterEach(() => {
        CrudConfigService.config = original; // keep the global singleton isolated
    });

    it('re-exports CrudConfigService and NestCrudModule from the package barrel', () => {
        expect(CrudConfigService).toBeDefined();
        expect(typeof CrudConfigService.load).toBe('function');
        expect(NestCrudModule).toBeDefined();
        expect(typeof NestCrudModule.forRoot).toBe('function');
    });

    it('CrudConfigService.load() merges global defaults and preserves existing ones', () => {
        CrudConfigService.load({ maxPageSize: 123, messages: { deleted: 'gone' } });
        expect(CrudConfigService.config.maxPageSize).toBe(123);
        expect(CrudConfigService.config.messages?.deleted).toBe('gone');
        expect(CrudConfigService.config.routes?.findMany).toBeDefined(); // defaults intact
    });

    it('NestCrudModule.forRoot(config) applies the config and returns a DynamicModule', () => {
        const mod = NestCrudModule.forRoot({ maxPageSize: 50 });
        expect(mod.module).toBe(NestCrudModule);
        expect(CrudConfigService.config.maxPageSize).toBe(50);
    });
});
