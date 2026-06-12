import { Repository, FindManyOptions, SelectQueryBuilder, Not, IsNull, ObjectLiteral } from 'typeorm';
import { BadRequestException } from '@nestjs/common';

import { IFindManyOptions } from '../interface/crud';
import { WhereQueryBuilder } from './where-query-builder';
import { JoinQueryBuilder } from './join-query-builder';
import { QueryBuilderHelper } from './query-builder-helper';
import { OrderDirectionEnum } from '../types';

export class FindQueryBuilder<T extends ObjectLiteral> {

    private builder: SelectQueryBuilder<T>;
    private whereQueryBuilder: WhereQueryBuilder;
    private joinQueryBuilder: JoinQueryBuilder<T>;
    private helper: QueryBuilderHelper<T>;

    constructor(private readonly repository: Repository<T>) {
        // Create QueryBuilder with the entity name as alias (e.g., 'User')
        this.builder = this.repository.createQueryBuilder(this.repository.metadata.targetName);

        this.helper = new QueryBuilderHelper(this.repository, this.builder);
        this.whereQueryBuilder = new WhereQueryBuilder(this.helper);
        this.joinQueryBuilder = new JoinQueryBuilder(this.helper);
    }

    getBuilder() {
        return this.builder;
    }

    /**
     * Convert IFindManyOptions to TypeORM's native FindManyOptions
     */
    build(options?: IFindManyOptions) {
        if (options) {
            const findOptions: FindManyOptions<T> = {};

            // Handle basic pagination
            if (options.take !== undefined) {
                findOptions.take = Number(options.take);
            }
            if (options.skip !== undefined) {
                findOptions.skip = Number(options.skip);
            }

            // Handle soft delete options
            if (options.withDeleted) {
                findOptions.withDeleted = true;
            }
            if (options?.onlyDeleted && this.repository.metadata.deleteDateColumn) {
                findOptions.withDeleted = true;
                this.builder.andWhere(`${this.builder.alias}.${this.repository.metadata.deleteDateColumn.propertyName} IS NOT NULL`);
            }

            this.builder.setFindOptions(findOptions);

            // Handle select after relations are established

            this.buildSelect(options.select);


            // Handle relations first so they're available for where clauses
            if (options.relations) {
                this.joinQueryBuilder.build(options.relations);
            }

            // Build WHERE conditions after everything else is set up
            if (options?.where) {
                this.whereQueryBuilder.build(options.where);
            }

            // Handle ordering
            if (options.order) {
                this.buildOrder(options.order);
            }
        }


        const cleanFields = Array.from(this.helper.selectedFields).map((fieldName) => {
            return this.helper.cleanFieldName(fieldName);
        });
        this.builder.select(cleanFields);

        return this.builder;
    }

    /**
     * Build select fields using addSelect for main entity fields
     */
    private buildSelect(select?: string[]) {
        if (!select || select.length === 0) {
            // Default projection excludes hidden columns.
            this.helper.visibleColumns.forEach(col => {
                this.helper.selectedFields.add(this.helper.getFieldWithAlias(col));
            })
            return;
        }

        // Silently drop hidden fields from an explicit select (don't reveal them),
        // then always include the root primary key(s). Without the pk, TypeORM cannot
        // map joined relations back to their parent rows and entity identity is lost.
        const fields = select.filter((field) => !this.helper.isHiddenField(field));
        for (const pk of this.helper.entityPrimaryColumns) {
            if (!fields.includes(pk)) {
                fields.push(pk);
            }
        }

        for (const field of fields) {
            this.helper.selectedFields.add(this.helper.getFieldWithAlias(field));
        }
    }

    private buildOrder(order: Record<string, OrderDirectionEnum>) {
        const quote = this.helper.getIdentifierQuote();
        // Don't call orderBy which overwrites everything, just use addOrderBy
        for (const key in order) {
            // Never order by a hidden column/relation (reject like an unknown field).
            if (this.helper.isHiddenField(key)) {
                throw new BadRequestException(`Invalid order field: '${key}'`);
            }

            let orderByExpression: string;
            const hasDot = key.includes('.');
            if (hasDot || this.helper.entityColumns.includes(key)) {
                // Relation path (e.g. "profile.name") – use alias and preserve quotes for DB
                const field = this.helper.getFieldWithAlias(key);
                orderByExpression = this.helper.cleanFieldName(field);
            }  else {
                // Virtual/computed alias (e.g. relation count "emailCount") – quote identifier only
                // so PostgreSQL preserves case (SELECT ... AS "emailCount" requires ORDER BY "emailCount")
                const unquoted = key.replace(new RegExp(quote, 'g'), '');
                orderByExpression = `${quote}${unquoted}${quote}`;
            }
            this.builder.addOrderBy(orderByExpression, order[key]);
        }
    }

    /**
     * Execute the query using repository methods
     */
    async getManyAndCount(): Promise<[T[], number]> {
        return this.builder.getManyAndCount();
    }

    /**
     * Execute query with just count
     */
    async getCount(): Promise<number> {
        return this.builder.getCount();
    }

    /**
     * Execute query to get many records
     */
    async getMany(): Promise<T[]> {
        return this.builder.getMany();
    }
}
