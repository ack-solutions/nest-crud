import { Repository, FindManyOptions, SelectQueryBuilder, Not, IsNull } from 'typeorm';

import { IFindManyOptions } from '../interface/crud';
import { WhereQueryBuilder } from './where-query-builder';
import { JoinQueryBuilder } from './join-query-builder';
import { QueryBuilderHelper } from './query-builder-helper';
import { OrderDirectionEnum } from '@ackplus/nest-crud-request';

export class FindQueryBuilder<T> {

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
            this.helper.entityColumns.forEach(col => {
                this.helper.selectedFields.add(this.helper.getFieldWithAlias(col));
            })
            return;
        }

        // Build array of fields with aliases
        const fieldsWithAliases: string[] = [];
        for (const field of select) {
            const fieldWithAlias = this.helper.getFieldWithAlias(field);
            fieldsWithAliases.push(fieldWithAlias);
        }

        for (const field of fieldsWithAliases) {
            this.helper.selectedFields.add(field);
        }
    }

    private buildOrder(order: Record<string, OrderDirectionEnum>) {
        // Don't call orderBy which overwrites everything, just use addOrderBy
        for (const key in order) {
            let field = this.helper.getFieldWithAlias(key);
            field = this.helper.cleanFieldName(field);
            this.builder.addOrderBy(field, order[key]);
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
