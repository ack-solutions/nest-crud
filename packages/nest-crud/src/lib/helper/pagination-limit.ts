import { BadRequestException } from '@nestjs/common';

import { DEFAULT_MAX_PER_PAGE } from '../constants';
import { CrudOptions, IFindManyOptions } from '../interface/crud';
import { CrudConfigService } from '../service/crud-config.service';

function toPositiveInt(value: unknown): number | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n <= 0) {
        return undefined;
    }
    return n;
}

/**
 * Resolves the effective max rows per page from `@Crud` / `CrudConfigService` only (not from request).
 * Supports legacy `maxPageSize`.
 */
export function resolveMaxPerPage(crudOptions?: Partial<CrudOptions>): number {
    const explicit = crudOptions?.maxPerPage ?? (crudOptions as any)?.maxPageSize;
    if (typeof explicit === 'number' && explicit > 0) {
        return Math.floor(explicit);
    }
    const fromGlobal =
        CrudConfigService.config.maxPerPage ?? (CrudConfigService.config as any).maxPageSize;
    if (typeof fromGlobal === 'number' && fromGlobal > 0) {
        return Math.floor(fromGlobal);
    }
    return DEFAULT_MAX_PER_PAGE;
}
/**
 * Ensures `take` does not exceed the configured maximum.
 */
export function assertTakeWithinMaxPerPage(take: number | undefined, maxPerPage: number): void {
    if (take === undefined || take === null) {
        return;
    }
    const n = Number(take);
    if (!Number.isFinite(n)) {
        return;
    }
    if (n > maxPerPage) {
        throw new BadRequestException(
            `Page size (${n}) exceeds maxPerPage (${maxPerPage}).`,
        );
    }
}

/**
 * Applies server-side pagination defaults and bounds so list queries never run unbounded.
 * Mutates `parsed` and removes `page`, `perPage`, `limit`, `offset`, and server-only keys.
 */
export function applyListPagination(parsed: IFindManyOptions, crudOptions?: Partial<CrudOptions>): void {
    const maxPerPage = resolveMaxPerPage(crudOptions);

    if (parsed.take === undefined || parsed.take <= 0) {
        parsed.take = maxPerPage;
    }

    assertTakeWithinMaxPerPage(parsed.take, maxPerPage);
}

/**
 * For `counts`: rejects `take`/`limit`/`perPage` above `maxPerPage`, then removes pagination fields
 * so aggregate counts are not limited by list defaults.
 */
export function sanitizeCountsFilter(parsed: IFindManyOptions, crudOptions?: Partial<CrudOptions>): void {

    const maxPerPage = resolveMaxPerPage(crudOptions);
    const take = toPositiveInt(parsed.take);

    if (take !== undefined) {
        assertTakeWithinMaxPerPage(take, maxPerPage);
    }

    delete parsed.take;
    delete parsed.skip;
}

/**
 * For "no pagination" list endpoints: still enforces `maxPerPage` as a hard cap,
 * and removes any skip/offset to prevent paged access.
 */
export function applyNoPaginationLimit(parsed: IFindManyOptions, crudOptions?: Partial<CrudOptions>): void {
    const maxPerPage = resolveMaxPerPage(crudOptions);

    if (parsed.take === undefined || parsed.take <= 0) {
        parsed.take = maxPerPage;
    }

    assertTakeWithinMaxPerPage(parsed.take, maxPerPage);

    // Explicitly disable pagination windowing
    delete parsed.skip;
}