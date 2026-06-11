import { SelectQueryBuilder } from 'typeorm';

import { WhereObject, WhereOperatorEnum, WhereOptions } from '../types';
import { QueryBuilderHelper } from './query-builder-helper';
import { BadRequestException } from '@nestjs/common';
import { QueryDebugger } from './query-debug.helper';
import { WhereOperatorRegistry } from './where-operators';

/**
 * Resolves a where/having key to a SQL left-hand expression and whether it is
 * allowed. WHERE uses the default (entity-column) resolver; HAVING passes one that
 * maps aggregate aliases to a derived-table column.
 */
export type LhsResolver = (key: string) => { expr: string; allowed: boolean };

/**
 * WhereQueryBuilder class for handling complex where conditions in TypeORM queries.
 * This class converts a structured where object into TypeORM query conditions.
 *
 * Example usage:
 * ```typescript
 * const where = [
 *   {
 *     $or: [
 *       { status: { $eq: 'pending' } },
 *       { status: { $eq: 'processing' } },
 *       {
 *         $and: [
 *           { total: { $gt: 1000 } },
 *           { tax: { $lte: 200 } },
 *         ],
 *       },
 *     ],
 *   },
 *   {
 *     customerId: { $in: ['cust_123', 'cust_456'] },
 *   }
 * ];
 * ```
 */
export class WhereQueryBuilder {

    // Counter for generating unique parameter names
    private paramIndex = 0;
    private paramsPrefix: string = 'where_param_';
    private builder: SelectQueryBuilder<any>;
    private logger: QueryDebugger;

    /** Default resolver: real entity columns, validated by the allowlist (used for WHERE). */
    private get defaultResolver(): LhsResolver {
        return (key) => ({
            expr: this.helper.getFieldWithAlias(key),
            allowed: this.helper.isAllowedField(key),
        });
    }

    constructor(
        private helper: QueryBuilderHelper<any>,
        logger?: QueryDebugger,
    ) {
        this.builder = this.helper.builder;
        this.logger = logger ?? new QueryDebugger('WhereQueryBuilder');
    }

    getBuilder() {
        return this.builder;
    }

    setParamsPrefix(prefix: string) {
        this.paramsPrefix = prefix;
    }

    /**
     * Builds the where condition and applies it to the query builder
     * @returns The modified SelectQueryBuilder with where conditions applied
     */
    build(whereObject: WhereOptions, resolver: LhsResolver = this.defaultResolver) {
        this.logger.log('Starting where build', whereObject);
        // return builder if no conditions
        if (!whereObject) {
            return this.builder;
        }

        // return builder if whereObject is empty array
        if (Array.isArray(whereObject) && !whereObject.length) {
            return this.builder;
        }

        // return builder if whereObject is empty object
        if (typeof whereObject === 'object' && !Object.keys(whereObject).length) {
            return this.builder;
        }

        // Handle root level array as $and group
        if (Array.isArray(whereObject)) {
            whereObject = { $and: whereObject };
        }

        // parse whereObject and apply to builder
        const { query, params } = this.buildWhereQueryAndParams(whereObject, resolver);

        this.logger.log('Where clause result', { query, params });

        // Only add where clause if we have conditions
        return query ? this.builder.andWhere(query, params) : this.builder;
    }


    /**
     * Recursively parses a where condition object into SQL query and parameters
     * @param condition - The where condition object to parse
     * @returns Object containing the SQL query string and parameters
     */
    buildWhereQueryAndParams(
        condition: WhereObject,
        resolver: LhsResolver = this.defaultResolver,
    ): { query: string; params: Record<string, any> } {

        const queryParts: string[] = [];
        const params: Record<string, any> = {};
        this.logger.log('Processing nested condition', condition);

        // Return empty query if input is empty
        if (!condition || !Object.keys(condition).length) {
            return { query: '', params: {} };
        }

        for (const key in condition) {
            const value = condition[key];

            // Handle logical operators ($and, $or)
            if (key === '$and' || key === '$or') {
                if (!Array.isArray(value) || !value.length) continue;

                const subParts: string[] = [];
                for (const sub of value) {
                    const { query, params: subParams } = this.buildWhereQueryAndParams(sub, resolver);
                    if (query) {
                        subParts.push(`(${query})`);
                        Object.assign(params, subParams);
                    }
                }

                if (subParts.length) {
                    const operator = key === '$and' ? ' AND ' : ' OR ';
                    // Wrap logical operator groups in parentheses for proper precedence
                    const groupedQuery = subParts.length > 1 ? `(${subParts.join(operator)})` : subParts.join(operator);
                    queryParts.push(groupedQuery);
                }
                continue;
            }

            // Relation-existence operators: { posts: { $exists: true } } / { $notExists: true }.
            // The key is a relation (not a column), so handle it before column resolution.
            if (
                value && typeof value === 'object' && !Array.isArray(value) &&
                ('$exists' in value || '$notExists' in value) &&
                this.helper.getRelationMetadata(key)
            ) {
                const existsClause = this.buildRelationExists(key, value);
                if (existsClause) {
                    queryParts.push(existsClause);
                }
                continue;
            }

            // Resolve the key to a SQL left-hand expression. WHERE uses the entity
            // column resolver; HAVING passes one that maps aggregate aliases to a
            // derived-table column. Unknown keys are rejected with a clean 400.
            const resolved = resolver(key);
            if (!resolved.allowed) {
                throw new BadRequestException(`Invalid filter field: '${key}'`);
            }
            const column = resolved.expr;

            // Handle comparison operators ($eq, $gt, $lt, etc.)
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                for (const op in value) {
                    const val = value[op];

                    const { query, params: subParams } = this.parseWhereObjectToQueryAndParams(column, val, op as WhereOperatorEnum);
                    if (query) {
                        queryParts.push(query);
                        Object.assign(params, subParams);
                    }
                }
            }
            // Handle simple equality conditions
            else {
                const { query, params: subParams } = this.parseWhereObjectToQueryAndParams(column, value);
                if (query) {
                    queryParts.push(query);
                    Object.assign(params, subParams);
                }
            }
        }

        const result = {
            query: queryParts.length ? queryParts.join(' AND ') : '',
            params,
        };
        this.logger.log('Nested condition result', result);
        return result;
    }

    /**
     * Converts a where condition into SQL query and parameters based on the operator
     * @param columnName - The database column name
     * @param value - The value to compare against
     * @param operator - The comparison operator (defaults to $eq)
     * @returns Object containing the SQL query string and parameters
     */
    private parseWhereObjectToQueryAndParams(columnName: string, value: any, operator: WhereOperatorEnum = WhereOperatorEnum.EQ) {

        const paramName = `${this.paramsPrefix}${this.paramIndex++}`;

        this.logger.log('Parsing where operator', {
            columnName,
            operator,
            value,
        });

        const handler = WhereOperatorRegistry.get(operator);
        if (!handler) {
            throw new BadRequestException(`Unsupported operator: ${operator}`);
        }

        return handler({
            column: columnName,
            value,
            param: paramName,
            operator,
            dbType: this.helper.dbType,
        });
    }

    /**
     * Build an `EXISTS` / `NOT EXISTS` clause for a relation key:
     *   `{ posts: { $exists: true } }`    → `EXISTS (SELECT 1 FROM posts p WHERE p.userId = root.id)`
     *   `{ posts: { $notExists: true } }` → `NOT EXISTS (...)`
     * `$exists: false` is equivalent to `$notExists: true`.
     */
    private buildRelationExists(relationKey: string, value: any): string {
        const { table, alias, condition } = this.helper.correlation(relationKey);
        const quote = this.helper.getIdentifierQuote();
        const wantExists = '$exists' in value ? value.$exists !== false : value.$notExists === false;
        const keyword = wantExists ? 'EXISTS' : 'NOT EXISTS';
        return `${keyword} (SELECT 1 FROM ${quote}${table}${quote} ${quote}${alias}${quote} WHERE ${condition})`;
    }
}
