import { BadRequestException, NotFoundException } from '@nestjs/common';
import { sumBy, uniq } from 'lodash';
import { FindOptionsWhere, In, Repository, SaveOptions, SelectQueryBuilder } from 'typeorm';
import type { DeepPartial } from 'typeorm';

import { BaseEntity } from '../base-entity';
import { AggregateQueryBuilder } from '../helper/aggregate-query-builder';
import { FindQueryBuilder } from '../helper/find-query-builder';
import { applyListPagination, applyNoPaginationLimit, sanitizeCountsFilter } from '../helper/pagination-limit';
import { RequestQueryParser } from '../helper/request-query-parser';
import { CrudActionsEnum, CrudMessages, CrudOptions, ICountsRequest, ICountsResult, IDeleteManyOptions, IFindManyOptions, IFindOneOptions, FindAllResponse, PaginationResponse } from '../interface/crud';
import { ID } from '../interface/typeorm';
import { CrudConfigService } from './crud-config.service';


export class CrudService<T extends BaseEntity> {

    options: CrudOptions;

    /**
     * Column written by `reorder()`. Defaults to `order` (the column on
     * `BaseEntityWithOrder`). Override in a subclass for entities that sort on a
     * different column:
     *
     * ```ts
     * class BlockService extends CrudService<Block> {
     *   protected reorderColumn = 'sortOrder';
     * }
     * ```
     */
    protected reorderColumn = 'order';

    constructor(readonly repository: Repository<T>) { }

    /**
     * Resolve a response message, allowing a global override via
     * `CrudConfigService.load({ messages })`. Falls back to the English default.
     */
    protected msg(key: keyof CrudMessages, fallback: string): string {
        return CrudConfigService.config.messages?.[key] ?? fallback;
    }

    /**
     * Hook that runs before `create()` and `update()` persist data.
     *
     * Use this to:
     * - Normalize/transform incoming fields (e.g. trim strings)
     * - Set server-side defaults (e.g. `createdBy`, `updatedBy`)
     * - Remove/override unsafe values before saving
     *
     * @param entity Partial entity payload that will be saved.
     * @param _request Optional original request context (controller can pass anything).
     * @returns The final entity payload that will be passed into TypeORM save/update.
     */
    protected async beforeSave(entity: Partial<T>, _request?: any): Promise<Partial<T>> {
        return entity;
    }

    /**
     * Hook that runs after `save()` and `update()`.
     *
     * Use this to:
     * - Add additional post-save logic (e.g. logging, notifications)
     * - Trigger related actions (e.g. indexing, cache invalidation)
     * - Validate the saved entity (e.g. check for required fields)
     *
     * @param newValue The newly saved entity (reloaded from DB).
     * @param _oldValue The previous entity state (before save).
     * @param _request The original request context.
     * @returns The final entity to return to the client.
     */
    protected async afterSave(newValue: T, _oldValue?: any, _request?: any): Promise<T> {
        return newValue;
    }

    /**
     * Hook that runs before `create()`.
     *
     * Use this to:
     * - Normalize/transform incoming fields (e.g. trim strings)
     * - Set server-side defaults (e.g. `createdBy`, `updatedBy`)
     * - Remove/override unsafe values before saving
     */
    protected async beforeCreate(entity: Partial<T>, _request?: any) {
        return entity;
    }

    /**
     * Hook that runs after `create()`.
     *
     * Use this to:
     * - Add additional post-save logic (e.g. logging, notifications)
     * - Trigger related actions (e.g. indexing, cache invalidation)
     * - Validate the saved entity (e.g. check for required fields)
     */
    protected async afterCreate(newValue: T, _oldValue?: any, _request?: any) {
        return newValue;
    }

    /**
     * Hook that runs before `update()`.
     *
     * Use this to:
     * - Normalize/transform incoming fields (e.g. trim strings)
     * - Set server-side defaults (e.g. `createdBy`, `updatedBy`)
     * - Remove/override unsafe values before saving
     */
    protected async beforeUpdate(entity: Partial<T>, _entityData?: T) {
        return entity;
    }

    /**
     * Hook that runs after `update()`.
     *
     * Use this to:
     * - Add additional post-save logic (e.g. logging, notifications)
     * - Trigger related actions (e.g. indexing, cache invalidation)
     * - Validate the saved entity (e.g. check for required fields)
     */
    protected async afterUpdate(newValue: T, _oldValue?: any, _request?: any) {
        return newValue;
    }


    /**
     * Hook that runs before executing list queries (`findMany()` and `findAll()`).
     *
     * Use this to:
     * - Add additional `andWhere` constraints (tenant scoping, RBAC, etc.)
     * - Force joins/relations
     * - Add default ordering when client didn’t specify one
     *
     * @param queryBuilder The TypeORM query builder produced by `FindQueryBuilder`.
     * @param _orgRequest The original request query object (raw query params).
     * @returns The query builder to execute (can be the same instance).
     */
    protected async beforeFindMany(queryBuilder: SelectQueryBuilder<T>, _orgRequest?: any): Promise<SelectQueryBuilder<T>> {
        return queryBuilder;
    }

    /**
     * Hook that runs before executing `counts()`.
     *
     * @param queryBuilder The TypeORM query builder produced by `FindQueryBuilder`.
     * @param _orgRequest The original request context.
     * @returns The query builder to execute.
     */
    protected async beforeCounts(queryBuilder: SelectQueryBuilder<T>, _orgRequest?: any): Promise<SelectQueryBuilder<T>> {
        return queryBuilder;
    }
    /**
     * Hook that runs before executing `findOne()`.
     *
     * @param queryBuilder The TypeORM query builder produced by `FindQueryBuilder`.
     * @param _orgRequest The original request context.
     * @returns The query builder to execute.
     */
    protected async beforeFindOne(queryBuilder: SelectQueryBuilder<T>, _orgRequest?: any): Promise<SelectQueryBuilder<T>> {
        return queryBuilder;
    }

    /**
     * Hook that runs before `delete()`.
     *
     * Use this to:
     * - Normalize/transform incoming fields (e.g. trim strings)
     * - Set server-side defaults (e.g. `createdBy`, `updatedBy`)
     * - Remove/override unsafe values before saving
     */
    protected async beforeDelete(data: T) {
        return data;
    }

    /**
     * Hook that runs after `delete()`.
     *
     * Use this to:
     * - Add additional post-save logic (e.g. logging, notifications)
     * - Trigger related actions (e.g. indexing, cache invalidation)
     * - Validate the saved entity (e.g. check for required fields)
     */
    protected async afterDelete(oldData: T) {
        return oldData;
    }

    /**
     * Hook that runs before `deleteMany()`.
     *
     * Use this to:
     * - Normalize/transform incoming fields (e.g. trim strings)
     * - Set server-side defaults (e.g. `createdBy`, `updatedBy`)
     * - Remove/override unsafe values before saving
     */
    protected async beforeDeleteMany(ids: ID[]) {
        return ids;
    }

    /**
     * Hook that runs after `deleteMany()`.
     *
     * Use this to:
     * - Add additional post-save logic (e.g. logging, notifications)
     * - Trigger related actions (e.g. indexing, cache invalidation)
     * - Validate the saved entity (e.g. check for required fields)
     */
    protected async afterDeleteMany(ids: ID[]) {
        return ids;
    }

    /**
     * Hook that runs before `deleteFromTrash()`.
     *
     * Use this to:
     * - Normalize/transform incoming fields (e.g. trim strings)
     * - Set server-side defaults (e.g. `createdBy`, `updatedBy`)
     * - Remove/override unsafe values before saving
     */
    protected async beforeDeleteFromTrash(data: T) {
        return data;
    }

    /**
     * Hook that runs after `deleteFromTrash()`.
     *
     * Use this to:
     * - Add additional post-save logic (e.g. logging, notifications)
     * - Trigger related actions (e.g. indexing, cache invalidation)
     * - Validate the saved entity (e.g. check for required fields)
     */
    protected async afterDeleteFromTrash(oldData: T) {
        return oldData;
    }

    /**
     * Hook that runs before `deleteFromTrashMany()`.
     *
     * Use this to:
     * - Normalize/transform incoming fields (e.g. trim strings)
     * - Set server-side defaults (e.g. `createdBy`, `updatedBy`)
     * - Remove/override unsafe values before saving
     */
    protected async beforeDeleteFromTrashMany(ids: ID[]) {
        return ids;
    }

    /**
     * Hook that runs after `deleteFromTrashMany()`.
     *
     * Use this to:
     * - Add additional post-save logic (e.g. logging, notifications)
     * - Trigger related actions (e.g. indexing, cache invalidation)
     * - Validate the saved entity (e.g. check for required fields)
     */
    protected async afterDeleteFromTrashMany(ids: ID[]) {
        return ids;
    }

    /**
     * Hook that runs before `restore()`.
     *
     * Use this to:
     * - Normalize/transform incoming fields (e.g. trim strings)
     * - Set server-side defaults (e.g. `createdBy`, `updatedBy`)
     * - Remove/override unsafe values before saving
     */
    protected async beforeRestore(data: T) {
        return data;
    }

    /**
     * Hook that runs after `restore()`.
     *
     * Use this to:
     * - Add additional post-save logic (e.g. logging, notifications)
     * - Trigger related actions (e.g. indexing, cache invalidation)
     * - Validate the saved entity (e.g. check for required fields)
     */
    protected async afterRestore(oldData: T) {
        return oldData;
    }

    /**
     * Hook that runs before `restoreMany()`.
     *
     * Use this to:
     * - Normalize/transform incoming fields (e.g. trim strings)
     * - Set server-side defaults (e.g. `createdBy`, `updatedBy`)
     * - Remove/override unsafe values before saving
     */
    protected async beforeRestoreMany(ids: ID[]) {
        return ids;
    }

    /**
     * Hook that runs after `restoreMany()`.
     *
     * Use this to:
     * - Add additional post-save logic (e.g. logging, notifications)
     * - Trigger related actions (e.g. indexing, cache invalidation)
     * - Validate the saved entity (e.g. check for required fields)
     */
    protected async afterRestoreMany(ids: ID[]) {
        return ids;
    }

    /**
     * Hook that augments the WHERE used by every mutation-by-criteria method:
     * `update` / `delete` / `deleteFromTrash` / `restore` and their bulk variants.
     *
     * This is the **write-side counterpart** to `beforeFindMany` / `beforeFindOne`.
     * Whatever criteria you return is what loads AND mutates the row(s), so a row
     * that doesn't match becomes invisible to writes: `update`/`delete` return
     * `404`, and the bulk variants silently skip it. Use it to make mutations
     * tenant-safe in one place instead of guarding each per-action hook.
     *
     * ```ts
     * // Every mutation is scoped to the caller's tenant.
     * protected async beforeMutate(criteria: FindOptionsWhere<Block>) {
     *   return { ...criteria, propertyId: this.ctx.propertyId };
     * }
     * ```
     *
     * The criteria is column-level (TypeORM's `delete`/`update`/`restore` WHERE),
     * so use plain columns — no relation joins. For single-row mutations `criteria`
     * is `{ id }`; for bulk it's `{ id: In(ids) }`.
     *
     * @param criteria The id/where criteria the mutation is about to run.
     * @param _action  Which mutation is running (a `CrudActionsEnum` value).
     * @returns The criteria to use (return it unchanged to keep default behaviour).
     */
    protected async beforeMutate(
        criteria: FindOptionsWhere<T>,
        _action: CrudActionsEnum,
    ): Promise<FindOptionsWhere<T>> {
        return criteria;
    }

    /**
     * Hook that runs before `reorder()` writes the new positions.
     *
     * Return a narrowed/transformed id list — e.g. keep only ids the caller owns,
     * so `reorder` becomes tenant-safe (it can't be scoped by a WHERE because it
     * writes positions per id):
     *
     * ```ts
     * protected async beforeReorder(ids: ID[]) {
     *   const owned = await this.repository.find({
     *     where: { id: In(ids), propertyId: this.ctx.propertyId } as any,
     *     select: ['id'],
     *   });
     *   const ownedIds = new Set(owned.map(r => r.id));
     *   return ids.filter(id => ownedIds.has(id as string)); // preserves order
     * }
     * ```
     */
    protected async beforeReorder(ids: ID[]): Promise<ID[]> {
        return ids;
    }

    /**
     * Create a single record.
     *
     * - Input: partial entity payload (only valid columns/relations are persisted)
     * - Output: the newly created entity (reloaded from DB)
     *
     * Hooks:
     * - `beforeSave()` then `beforeCreate()` run before persistence
     * - `afterSave()` then `afterCreate()` run after persistence
     */
    async create(data: Partial<T>, saveOptions: SaveOptions = {}): Promise<T> {
        if (!data || Object.keys(data).length === 0) {
            throw new BadRequestException('No data provided for insert.');
        }
        data = await this.beforeSave(data);

        // Filter out invalid columns
        const validColumns = this.repository.metadata.columns.map(c => c.propertyName);
        const validRelations = this.repository.metadata.relations.map(r => r.propertyName);
        const validProperties = [...validColumns, ...validRelations];

        let filteredData: any = Object.fromEntries(Object.entries(data).filter(([key]) => validProperties.includes(key)));
        filteredData = await this.beforeCreate(filteredData);

        const entity = this.repository.create(filteredData);
        const saved = await this.repository.save(entity as unknown as T, saveOptions);

        const primaryKey = this.repository.metadata.primaryColumns[0].propertyName;
        const createdEntity = await this.repository.findOneByOrFail({
            [primaryKey]: saved[primaryKey],
        } as FindOptionsWhere<T>);

        await this.afterSave(createdEntity, null, filteredData);
        await this.afterCreate(createdEntity, null, filteredData);

        return createdEntity;
    }

    /**
     * Create multiple records in a transaction.
     *
     * - Input: `{ bulk: Partial<T>[] }`
     * - Output: array of created entities
     *
     * Hooks:
     * - For each item: `beforeSave()` + `beforeCreate()` before persistence
     * - For each saved item: `afterSave()` + `afterCreate()` after persistence
     */
    async createMany(
        data: { bulk: Partial<T>[] },
        saveOptions: SaveOptions = {},
        ..._others: any[]
    ): Promise<T[]> {
        return this.repository.manager.transaction(async (manager) => {
            let bulk = await Promise.all(
                data.bulk.map(item => this.beforeSave(item)),
            );

            bulk = await Promise.all(
                bulk.map(item => this.beforeCreate(item)),
            );

            const entities = manager.create(this.repository.target as any, bulk);

            const savedEntities = await manager.save<T>(entities as T[], saveOptions);

            // Reload so generated columns / DB defaults / relations are present,
            // matching the single create() behaviour. One IN(...) query (not N
            // concurrent ones) — concurrent queries on a transaction's single
            // connection are deprecated in pg and removed in pg@9.
            const primaryKey = this.repository.metadata.primaryColumns[0].propertyName;
            const ids = savedEntities.map((saved: any) => saved[primaryKey]);
            const found = await manager.find(this.repository.target as any, {
                where: { [primaryKey]: In(ids) },
            }) as T[];
            const byId = new Map(found.map((e: any) => [String(e[primaryKey]), e]));
            const reloaded = savedEntities.map((saved: any) => byId.get(String(saved[primaryKey])) ?? saved) as T[];

            for (let i = 0; i < reloaded.length; i++) {
                await this.afterSave(reloaded[i], null, data.bulk[i]);
                await this.afterCreate(reloaded[i], null, data.bulk[i]);
            }

            return reloaded;
        });
    }

    async findMany(query: IFindManyOptions, crudOptions?: Partial<CrudOptions>, ..._others: any[]): Promise<PaginationResponse<T>> {
        /**
         * List endpoint WITH pagination metadata.
         *
         * Query parameters (same for `findMany` and `findAll`):
         * - `where`: JSON string or nested object. Supports operators like `$eq`, `$in`, `$like`, `$and`, `$or`, etc.
         * - `relations`: JSON string/object to join relations (and optional relation-level where/select).
         * - `order`: JSON string/object like `{ "createdAt": "DESC" }`
         * - `select`: JSON string/array of columns to select
         * - Soft delete flags: `withDeleted=true` or `onlyDeleted=true`
         *
         * Pagination parameters:
         * - `take` / `limit`: page size (server enforces `maxPerPage`)
         * - `skip` / `offset`: starting index
         *
         * Response:
         * - `{ items: T[]; total: number }`
         */
        const parsedOptions = RequestQueryParser.parse(query || {});
        applyListPagination(parsedOptions, crudOptions);

        // Aggregate path: user-defined count/sum/avg/min/max over relations, with
        // optional HAVING/order on the aggregate aliases (two-phase derived table).
        if (AggregateQueryBuilder.has(parsedOptions)) {
            return this.createAggregateQueryBuilder().getManyAndCount(parsedOptions);
        }

        let queryBuilder = this.createFindQueryBuilder();

        let builder = queryBuilder.build(parsedOptions);
        builder = await this.beforeFindMany(builder, query);
        const [items, total] = await builder.getManyAndCount();

        return {
            items,
            total,
        };
    }

    /**
  * List endpoint WITHOUT pagination metadata.
  *
  * - Uses the same filtering/sorting/relations/select parameters as `findMany()`
  * - Ignores any `skip/offset` so clients can’t page through results here
  * - Still enforces `maxPerPage` as a hard cap to prevent unbounded queries
  *
  * Response:
  * - `T[]` (only data, no `total`)
  */
    async findAll(query: IFindManyOptions, crudOptions?: Partial<CrudOptions>, ..._others: any[]): Promise<FindAllResponse<T>> {
        const parsedOptions = RequestQueryParser.parse(query || {});
        applyNoPaginationLimit(parsedOptions, crudOptions);

        if (AggregateQueryBuilder.has(parsedOptions)) {
            const { items } = await this.createAggregateQueryBuilder().getManyAndCount(parsedOptions);
            return items;
        }

        let queryBuilder = this.createFindQueryBuilder();

        let builder = queryBuilder.build(parsedOptions);
        builder = await this.beforeFindMany(builder, query);
        return builder.getMany();
    }

    /**
     * Factory for the list query builder. Override in a subclass to customise how
     * filtering / relations / select are turned into SQL (the standard extension
     * point alongside the `beforeFindMany` hook).
     */
    protected createFindQueryBuilder(): FindQueryBuilder<T> {
        return new FindQueryBuilder(this.repository);
    }

    /**
     * Factory for the aggregate (two-phase) query builder. Override to customise the
     * aggregate execution. Note: `beforeFindMany` is not applied on the aggregate
     * path — override this instead.
     */
    protected createAggregateQueryBuilder(): AggregateQueryBuilder<T> {
        return new AggregateQueryBuilder(this.repository);
    }

    /**
     * Return counts for the given filter.
     *
     * - Input: `{ filter: <same query shape as findMany/findAll>, groupByKey?: string|string[] }`
     * - Output:
     *   - Without `groupByKey`: `{ total: number }`
     *   - With `groupByKey`: `{ total: number; data: Array<{ count: number } & Record<string, any>> }`
     *
     * Notes:
     * - Pagination fields are removed from the filter so the count isn't page-limited.
     * - `maxPerPage` is still enforced if the client tries to pass `take/limit` above the max.
     */
    async counts(request: ICountsRequest, crudOptions?: Partial<CrudOptions>): Promise<ICountsResult> {
        const groupByKey = request.groupByKey ?? null;
        // make sure filter becomes a real object even if request has "filter[where]" keys
        const parsedOptions = RequestQueryParser.parse(request?.filter || {});
        sanitizeCountsFilter(parsedOptions, crudOptions);

        // Parse filter if it's a raw query parameter
        let queryBuilder = this.createFindQueryBuilder();
        let query = queryBuilder.build(parsedOptions);
        query = await this.beforeCounts(query);

        let result: ICountsResult = {
            total: 0,
        }

        const primaryColumn = this.repository.metadata.primaryColumns[0].propertyName;

        // No groupByKey: return total count
        if (!groupByKey) {
            query.select(`COUNT("${query.alias}"."${primaryColumn}")`, 'count');
            const response = await query.getRawOne() as { count: number } | undefined;
            result.total = Number(response?.count) || 0;
            return result;
        }

        // Normalize and validate groupByKey
        const groupKeys = Array.isArray(groupByKey) ? uniq(groupByKey) : [groupByKey];
        const validColumns = this.repository.metadata.columns.map(col => col.propertyName);
        const invalidKeys = groupKeys.filter(key => !validColumns.includes(key));

        if (invalidKeys.length) {
            throw new BadRequestException(`Invalid groupByKey: ${invalidKeys.join(', ')}. Valid columns are: ${validColumns.join(', ')}`);
        }

        // Add COUNT and groupings
        query.select(`COUNT("${query.alias}"."${primaryColumn}")`, 'count');
        groupKeys.forEach(key => {
            query.addSelect(`"${query.alias}"."${key}"`, key);
            query.addGroupBy(`"${query.alias}"."${key}"`);
        });
        query.limit(1000);

        const response = await query.getRawMany() as Array<{ count: number } & Record<string, any>>;
        const total = sumBy(response, (item) => Number(item.count) || 0);

        result.total = total;
        result.data = response.map(item => ({
            ...item,
            count: Number(item.count) || 0,
        }));
        return result;
    }

    /**
     * Find one record by `id`.
     *
     * - Input:
     *   - `id`: primary identifier
     *   - `query`: same join/select options as list endpoints (relations/select/where)
     * - Output: entity `T`
     *
     * Notes:
     * - `id` is always enforced via `where: { id: { $eq: id } }` (merged with extra `where`).
     * - Throws `NotFoundException` when nothing matches.
     */
    async findOne(id: ID, query: IFindOneOptions = {}, ..._others: any[]): Promise<T> {
        // Parse query parameters for joins
        const parsedOptions = RequestQueryParser.parse(query || {});

        const queryBuilder = new FindQueryBuilder(this.repository);

        const whereWithId = {
            ...(parsedOptions?.where || {}),
            // Enforced last so a caller-provided `where.id` can't override the path id.
            id: { $eq: id },
        };

        let builder = queryBuilder.build({
            ...(parsedOptions || {}),
            where: whereWithId,
        });

        builder = await this.beforeFindOne(builder, { id, ...query });

        const results = await builder.getOne();
        if (!results) {
            throw new NotFoundException(`${this.repository.metadata.name} not found`);
        }
        return results;
    }

    /**
     * Update a single record by id or where-criteria.
     *
     * - Input:
     *   - `criteria`: `id` (string/number) or `FindOptionsWhere<T>`
     *   - `data`: partial entity payload
     * - Output: updated entity `T` (reloaded from DB)
     *
     * Hooks:
     * - `beforeSave()` then `beforeUpdate()` run before persistence
     * - `afterSave()` then `afterUpdate()` run after persistence
     *
     * Throws `NotFoundException` if record doesn't exist.
     */
    async update(criteria: ID | FindOptionsWhere<T>, data: Partial<T>, ..._others: any[]) {
        const where = await this.resolveMutateWhere(criteria, CrudActionsEnum.UPDATE);
        const oldData = await this.repository.findOne({ where });
        if (!oldData) {
            throw new NotFoundException(`${this.repository.metadata.name} not found`);
        }
        data = await this.beforeSave(data);
        data = await this.beforeUpdate(data, oldData);
        const entity = this.repository.create({
            ...data,
            id: oldData?.id,
        } as DeepPartial<T>);
        await this.repository.save(entity);

        const result = await this.repository.findOne({ where }) as T;

        await this.afterSave(result, oldData, data);
        await this.afterUpdate(result, oldData, data);
        return result;
    }

    /**
     * Update multiple records in a transaction.
     *
     * - Input: `{ bulk: Array<Partial<T> & { id: ID }> }`
     * - Output: array of updated entities (only those found + updated)
     *
     * Notes:
     * - Items without `id` are skipped.
     * - Missing records are skipped (no error).
     * - Hooks `beforeSave/beforeUpdate` and `afterSave/afterUpdate` run per item.
     */
    async updateMany(
        data: { bulk: (Partial<T> & { id: ID })[] },
        ..._others: any[]
    ): Promise<T[]> {
        return this.repository.manager.transaction(async (manager) => {
            const results: T[] = [];

            for (const item of data.bulk) {
                const id = item.id;
                if (!id) continue;

                const where = await this.resolveMutateWhere(id, CrudActionsEnum.UPDATE_MANY);

                const oldData = await manager.findOne(this.repository.target as any, {
                    where,
                });

                if (!oldData) continue;

                let newData = await this.beforeSave(item);
                newData = await this.beforeUpdate(newData, oldData);

                await manager.save(this.repository.create({
                    ...newData,
                    id: oldData?.id,
                } as DeepPartial<T>));

                const updated = await manager.findOne(this.repository.target as any, {
                    where,
                });

                if (updated) {
                    await this.afterSave(updated, oldData, newData);
                    await this.afterUpdate(updated, oldData, newData);
                    results.push(updated);
                }
            }

            return results;
        });
    }

    /**
     * Delete a single record by id or where-criteria.
     *
     * - If `softDelete` is true: uses TypeORM `softDelete`
     * - Else: uses TypeORM `delete` (hard delete)
     *
     * Output: `{ message: string }`
     * Throws `NotFoundException` if record doesn't exist.
     */
    async delete(criteria: ID | FindOptionsWhere<T>, softDelete?: boolean, ..._others: any) {
        const where = await this.resolveMutateWhere(criteria, CrudActionsEnum.DELETE);

        const oldData = await this.repository.findOne({ where });
        if (!oldData) {
            throw new NotFoundException(`${this.repository.metadata.name} with criteria ${JSON.stringify(where)} not found`);
        }

        await this.beforeDelete(oldData);

        if (softDelete) {
            await this.repository.softDelete(where);
        } else {
            await this.repository.delete(where);
        }

        await this.afterDelete(oldData);
        return {
            success: true,
            message: this.msg('deleted', 'Successfully deleted'),
        };
    }

    /**
     * Delete multiple records by ids.
     *
     * - Input: `{ ids: string[] }`
     * - Behavior:
     *   - If `softDelete` is true: soft-deletes by ids
     *   - Else: hard-deletes by ids
     * - Output: `{ message: string }`
     */
    async deleteMany(params: IDeleteManyOptions, softDelete?: boolean, ..._others: any) {
        if (!params.ids || params.ids.length === 0) {
            return {
                success: true,
                message: this.msg('noItemsToDelete', 'No items to delete'),
            };
        }
        const ids = await this.beforeDeleteMany(params.ids);
        if (ids?.length > 0) {
            const where = await this.resolveMutateWhere(
                { id: In(ids) } as FindOptionsWhere<T>,
                CrudActionsEnum.DELETE_MANY,
            );
            if (softDelete) {
                await this.repository.softDelete(where);
            } else {
                await this.repository.delete(where);
            }
            await this.afterDeleteMany(ids);
            return {
                success: true,
                message: this.msg('deleted', 'Successfully deleted'),
            };
        }
        return {
            success: true,
            message: this.msg('noItemsToDelete', 'No items to delete'),
        };
    }

    /**
     * Permanently delete a single record from trash (soft-delete enabled mode).
     *
     * - Input: `id` or where-criteria
     * - Output: `{ success: true, message: string }`
     *
     * Notes:
     * - Reads with `withDeleted: true` so it can target soft-deleted rows.
     */
    async deleteFromTrash(criteria: ID | FindOptionsWhere<T>, ..._others: any[]) {
        const where = await this.resolveMutateWhere(criteria, CrudActionsEnum.DELETE_FROM_TRASH);

        const oldData = await this.repository.findOne({
            where,
            withDeleted: true,
        });

        if (!oldData) {
            throw new NotFoundException(`${this.repository.metadata.name} with criteria ${JSON.stringify(where)} not found`);
        }

        await this.beforeDeleteFromTrash(oldData);

        await this.repository.delete(where);
        await this.afterDeleteFromTrash(oldData);
        return {
            success: true,
            message: this.msg('deleted', 'Successfully deleted'),
        };
    }

    /**
     * Permanently delete multiple records from trash (soft-delete enabled mode).
     *
     * - Input: `{ ids: string[] }`
     * - Output: `{ success: true, message: string }`
     */
    async deleteFromTrashMany(params: IDeleteManyOptions, ..._others: any[]) {
        if (!params.ids || params.ids.length === 0) {
            return {
                success: true,
                message: this.msg('noItemsToDelete', 'No items to delete'),
            };
        }
        const ids = await this.beforeDeleteFromTrashMany(params.ids);
        if (ids?.length > 0) {
            const where = await this.resolveMutateWhere(
                { id: In(ids) } as FindOptionsWhere<T>,
                CrudActionsEnum.DELETE_FROM_TRASH_MANY,
            );
            await this.repository.delete(where);
            await this.afterDeleteFromTrashMany(ids);
        }
        return {
            success: true,
            message: this.msg('deleted', 'Successfully deleted'),
        };
    }

    /**
     * Restore a single soft-deleted record.
     *
     * - Input: `id` or where-criteria
     * - Output: `{ success: true, message: string }`
     *
     * Notes:
     * - Reads with `withDeleted: true` so it can restore soft-deleted rows.
     */
    async restore(criteria: ID | FindOptionsWhere<T>, ..._others: any[]) {
        const where = await this.resolveMutateWhere(criteria, CrudActionsEnum.RESTORE);

        const oldData = await this.repository.findOne({
            where,
            withDeleted: true,
        });
        if (!oldData) {
            throw new NotFoundException(`${this.repository.metadata.name} with criteria ${JSON.stringify(where)} not found`);
        }

        await this.beforeRestore(oldData);

        await this.repository.restore(where);

        await this.afterRestore(oldData);
        return {
            success: true,
            message: this.msg('restored', 'Successfully restored'),
        };
    }

    /**
     * Restore multiple soft-deleted records.
     *
     * - Input: `{ ids: ID[] }`
     * - Output: `{ success: true, message: string }`
     */
    async restoreMany(params: { ids: ID[] }, ..._others: any[]) {
        const ids = await this.beforeRestoreMany(params.ids);
        if (ids?.length > 0) {
            const where = await this.resolveMutateWhere(
                { id: In(ids) } as FindOptionsWhere<T>,
                CrudActionsEnum.RESTORE_MANY,
            );
            await this.repository.restore(where);
            await this.afterRestoreMany(ids);
        }
        return {
            success: true,
            message: this.msg('restored', 'Successfully restored'),
        };
    }

    /**
     * Reorder records by writing their new position into the `reorderColumn`.
     *
     * - Input: ordered array of ids
     * - Output: `{ success, message }`
     *
     * Hooks / config:
     * - `beforeReorder(ids)` runs first — narrow the list (e.g. to tenant-owned
     *   ids) to make reorder tenant-safe.
     * - `reorderColumn` (default `order`) selects the column written; override it
     *   for entities that sort on a different column (e.g. `sortOrder`).
     *
     * Notes:
     * - Throws `400` if `reorderColumn` isn't a real column on the entity.
     * - Writes \(N\) updates (one per id) inside a transaction.
     */
    async reorder(order: ID[], ..._others: any[]) {
        order = await this.beforeReorder(order ?? []);
        if (!order?.length) {
            return {
                success: true,
                message: this.msg('reordered', 'Successfully reordered'),
            };
        }

        const column = this.reorderColumn;
        const hasColumn = this.repository.metadata.columns.some(c => c.propertyName === column);
        if (!hasColumn) {
            throw new BadRequestException(
                `Reorder column "${column}" does not exist on ${this.repository.metadata.name}. Set "reorderColumn" on the service to the entity's sort column.`,
            );
        }

        // Wrap in a transaction so a partial reorder is never committed on failure.
        await this.repository.manager.transaction(async (manager) => {
            for (let i = 0; i < order.length; i++) {
                await manager.update(this.repository.target, order[i] as any, { [column]: i } as any);
            }
        });
        return {
            success: true,
            message: this.msg('reordered', 'Successfully reordered'),
        };
    }

    /**
     * Normalize "criteria" input into a TypeORM `FindOptionsWhere<T>`.
     *
     * - If criteria is `string|number`, it becomes `{ id: criteria }`
     * - If it's already an object, it's returned as-is
     */
    protected parseFindOptions(criteria: ID | FindOptionsWhere<T>, ..._others: any[]) {
        if (typeof criteria === 'string' || typeof criteria === 'number') {
            criteria = { id: criteria } as any;
        }
        return criteria as FindOptionsWhere<T>;
    }

    /**
     * Normalize criteria and run it through `beforeMutate`, so every mutation
     * loads and writes through the same (optionally scoped) WHERE.
     */
    protected async resolveMutateWhere(
        criteria: ID | FindOptionsWhere<T>,
        action: CrudActionsEnum,
    ): Promise<FindOptionsWhere<T>> {
        return this.beforeMutate(this.parseFindOptions(criteria), action);
    }

}
