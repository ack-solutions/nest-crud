import { NotFoundException } from '@nestjs/common';
import { sumBy, uniq } from 'lodash';
import { FindOptionsWhere, In, Repository, SaveOptions, SelectQueryBuilder } from 'typeorm';
import type { DeepPartial } from 'typeorm';

import { BaseEntity } from '../base-entity';
import { FindQueryBuilder } from '../helper/find-query-builder';
import { RequestQueryParser } from '../helper/request-query-parser';
import { CrudOptions, ICountsRequest, ICountsResult, IDeleteManyOptions, IFindManyOptions, IFindOneOptions, PaginationResponse } from '../interface/crud';
import { ID } from '../interface/typeorm';


export class CrudService<T extends BaseEntity> {

    options: CrudOptions;

    constructor(readonly repository: Repository<T>) { }

    protected async beforeSave(entity: Partial<T>, _request?: any): Promise<Partial<T>> {
        return entity;
    }
    protected async afterSave(newValue: T, _oldValue?: any, _request?: any): Promise<T> {
        return newValue;
    }

    protected async beforeCreate(entity: Partial<T>, _request?: any) {
        return entity;
    }

    protected async afterCreate(newValue: T, _oldValue?: any, _request?: any) {
        return newValue;
    }

    protected async beforeUpdate(entity: Partial<T>, _entityData?: T) {
        return entity;
    }

    protected async afterUpdate(newValue: T, _oldValue?: any, _request?: any) {
        return newValue;
    }


    protected async beforeFindMany(queryBuilder: SelectQueryBuilder<T>, _orgRequest?: any): Promise<SelectQueryBuilder<T>> {
        return queryBuilder;
    }

    protected async beforeCounts(queryBuilder: SelectQueryBuilder<T>, _orgRequest?: any): Promise<SelectQueryBuilder<T>> {
        return queryBuilder;
    }

    protected async beforeFindOne(queryBuilder: SelectQueryBuilder<T>, _orgRequest?: any): Promise<SelectQueryBuilder<T>> {
        return queryBuilder;
    }


    protected async beforeDelete(data: T) {
        return data;
    }

    protected async afterDelete(oldData: T) {
        return oldData;
    }

    protected async beforeDeleteMany(ids: ID[]) {
        return ids;
    }

    protected async afterDeleteMany(ids: ID[]) {
        return ids;
    }

    protected async beforeDeleteFromTrash(data: T) {
        return data;
    }

    protected async afterDeleteFromTrash(oldData: T) {
        return oldData;
    }

    protected async beforeDeleteFromTrashMany(ids: ID[]) {
        return ids;
    }

    protected async afterDeleteFromTrashMany(ids: ID[]) {
        return ids;
    }

    protected async beforeRestore(data: T) {
        return data;
    }

    protected async afterRestore(oldData: T) {
        return oldData;
    }

    protected async beforeRestoreMany(ids: ID[]) {
        return ids;
    }

    protected async afterRestoreMany(ids: ID[]) {
        return ids;
    }

    async create(data: Partial<T>, saveOptions: SaveOptions = {}): Promise<T> {
        if (!data || Object.keys(data).length === 0) {
            throw new Error('No data provided for insert.');
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

            for (let i = 0; i < savedEntities.length; i++) {
                await this.afterSave(savedEntities[i], null, data.bulk[i]);
                await this.afterCreate(savedEntities[i], null, data.bulk[i]);
            }

            return savedEntities;
        });
    }

    async findMany(query: IFindManyOptions, ..._others: any[]): Promise<PaginationResponse<T>> {
        // Parse raw query parameters into structured options
        const parsedOptions = RequestQueryParser.parse(query || {});

        let queryBuilder = new FindQueryBuilder(this.repository);

        let builder = queryBuilder.build(parsedOptions);
        builder = await this.beforeFindMany(builder, query);
        const [items, total] = await builder.getManyAndCount();

        return {
            items,
            total,
        };
    }

    async counts(request: ICountsRequest): Promise<ICountsResult> {
        const groupByKey = request.groupByKey ?? null;
        // make sure filter becomes a real object even if request has "filter[where]" keys
        const rawFilter = RequestQueryParser.extractFilterFromRequest(request);
        const parsedOptions = RequestQueryParser.parse(rawFilter || {});

        // Parse filter if it's a raw query parameter
        let queryBuilder = new FindQueryBuilder(this.repository);
        let query = queryBuilder.build(parsedOptions);
        query = await this.beforeCounts(query);

        let result: ICountsResult = {
            total: 0,
        }

        // No groupByKey: return total count
        if (!groupByKey) {
            query.select(`COUNT("${query.alias}"."id")`, 'count');
            const response = await query.getRawOne() as { count: number };
            result.total = Number(response.count) || 0;
            return result;
        }

        // Normalize and validate groupByKey
        const groupKeys = Array.isArray(groupByKey) ? uniq(groupByKey) : [groupByKey];
        const validColumns = this.repository.metadata.columns.map(col => col.propertyName);
        const invalidKeys = groupKeys.filter(key => !validColumns.includes(key));

        if (invalidKeys.length) {
            throw new Error(`Invalid groupByKey: ${invalidKeys.join(', ')}. Valid columns are: ${validColumns.join(', ')}`);
        }

        // Add COUNT and groupings
        query.select(`COUNT("${query.alias}"."id")`, 'count');
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

    async findOne(id: ID, query: IFindOneOptions = {}, ..._others: any[]): Promise<T> {
        // Parse query parameters for joins
        const parsedOptions = RequestQueryParser.parse(query || {});

        const queryBuilder = new FindQueryBuilder(this.repository);

        const whereWithId = {
            id: { $eq: id },
            ...(parsedOptions?.where || {})
        };

        const builder = queryBuilder.build({
            ...(parsedOptions || {}),
            where: whereWithId,
        });

        await this.beforeFindOne(builder, { id, ...query });

        const results = await builder.getOne();
        if (!results) {
            throw new NotFoundException(`${this.repository.metadata.name} not found`);
        }
        return results;
    }

    async update(criteria: ID | FindOptionsWhere<T>, data: Partial<T>, ..._others: any[]) {
        criteria = this.parseFindOptions(criteria);
        const oldData = await this.repository.findOne({ where: criteria });
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

        const result = await this.repository.findOne({ where: criteria }) as T;

        await this.afterSave(result, oldData, data);
        await this.afterUpdate(result, oldData, data);
        return result;
    }

    async updateMany(
        data: { bulk: (Partial<T> & { id: ID })[] },
        ..._others: any[]
    ): Promise<T[]> {
        return this.repository.manager.transaction(async (manager) => {
            const results: T[] = [];

            for (const item of data.bulk) {
                const id = item.id;
                if (!id) continue;

                const criteria = this.parseFindOptions(id);

                const oldData = await manager.findOne(this.repository.target as any, {
                    where: criteria,
                });

                if (!oldData) continue;

                let newData = await this.beforeSave(item);
                newData = await this.beforeUpdate(newData, oldData);

                await manager.save(this.repository.create({
                    ...newData,
                    id: oldData?.id,
                } as DeepPartial<T>));

                const updated = await manager.findOne(this.repository.target as any, {
                    where: criteria,
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

    async delete(criteria: ID | FindOptionsWhere<T>, softDelete?: boolean, ..._others: any) {
        criteria = this.parseFindOptions(criteria);

        const oldData = await this.repository.findOne({ where: criteria });
        if (!oldData) {
            throw new NotFoundException(`${this.repository.metadata.name} with criteria ${JSON.stringify(criteria)} not found`);
        }

        await this.beforeDelete(oldData);

        if (softDelete) {
            await this.repository.softDelete(criteria);
        } else {
            await this.repository.delete(criteria);
        }

        await this.afterDelete(oldData);
        return {
            message: 'Successfully deleted',
        };
    }

    async deleteMany(params: IDeleteManyOptions, softDelete?: boolean, ..._others: any) {
        if (!params.ids || params.ids.length === 0) {
            return {
                message: 'No items to delete',
            };
        }
        const ids = await this.beforeDeleteMany(params.ids);
        if (ids?.length > 0) {
            if (softDelete) {
                await this.repository.softDelete({ id: In(ids) as any });
            } else {
                await this.repository.delete({ id: In(ids) as any });
            }
            await this.afterDeleteMany(ids);
            return {
                message: 'Successfully deleted',
            };
        }
        return {
            message: 'No items to delete',
        };
    }

    async deleteFromTrash(criteria: ID | FindOptionsWhere<T>, ..._others: any[]) {
        criteria = this.parseFindOptions(criteria);

        const oldData = await this.repository.findOne({
            where: criteria,
            withDeleted: true,
        });

        if (!oldData) {
            throw new NotFoundException(`${this.repository.metadata.name} with criteria ${JSON.stringify(criteria)} not found`);
        }

        await this.beforeDeleteFromTrash(oldData);

        await this.repository.delete(criteria);
        await this.afterDeleteFromTrash(oldData);
        return {
            success: true,
            message: 'Successfully deleted',
        };
    }

    async deleteFromTrashMany(params: IDeleteManyOptions, ..._others: any[]) {
        if (!params.ids || params.ids.length === 0) {
            return {
                success: true,
                message: 'No items to delete',
            };
        }
        const ids = await this.beforeDeleteFromTrashMany(params.ids);
        if (ids?.length > 0) {
            await this.repository.delete({ id: In(ids) as any });
            await this.afterDeleteFromTrashMany(ids);
        }
        return {
            success: true,
            message: 'Successfully deleted',
        };
    }

    async restore(criteria: ID | FindOptionsWhere<T>, ..._others: any[]) {
        criteria = this.parseFindOptions(criteria);

        const oldData = await this.repository.findOne({
            where: criteria,
            withDeleted: true,
        });
        if (!oldData) {
            throw new NotFoundException(`${this.repository.metadata.name} with criteria ${JSON.stringify(criteria)} not found`);
        }

        await this.beforeRestore(oldData);

        await this.repository.restore(criteria);

        await this.afterRestore(oldData);
        return {
            success: true,
            message: 'Successfully restored',
        };
    }

    async restoreMany(params: { ids: ID[] }, ..._others: any[]) {
        const ids = await this.beforeRestoreMany(params.ids);
        if (ids?.length > 0) {
            await this.repository.restore({
                id: In(ids) as any,
            });
            await this.afterRestoreMany(ids);
        }
        return {
            success: true,
            message: 'Successfully restored',
        };
    }

    async reorder(order: ID[], ..._others: any[]) {
        for (let i = 0; i < order.length; i++) {
            await this.repository.update(order[i], { order: i } as any);
        }
    }

    protected parseFindOptions(criteria: ID | FindOptionsWhere<T>, ..._others: any[]) {
        if (typeof criteria === 'string' || typeof criteria === 'number') {
            criteria = { id: criteria } as any;
        }
        return criteria as FindOptionsWhere<T>;
    }

}
