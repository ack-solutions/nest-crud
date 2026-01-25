import { SelectQueryBuilder } from 'typeorm';

import { WhereObject, WhereOperatorEnum, WhereOptions } from '../types';
import { QueryBuilderHelper } from './query-builder-helper';
import { BadRequestException } from '@nestjs/common';
import { QueryDebugger } from './query-debug.helper';

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
     * Convert column to text for LIKE operations in a database-agnostic way
     */
    private convertToText(columnName: string): string {
        const dbType = this.helper.dbType;

        switch (dbType) {
            case 'postgres':
            case 'postgresql':
                return `${columnName}::text`;
            case 'sqlite':
            case 'better-sqlite3':
                return `CAST(${columnName} AS TEXT)`;
            case 'mysql':
            case 'mariadb':
                return `CAST(${columnName} AS CHAR)`;
            case 'mssql':
                return `CAST(${columnName} AS NVARCHAR(MAX))`;
            case 'oracle':
                return `TO_CHAR(${columnName})`;
            default:
                // Fallback to standard SQL CAST
                return `CAST(${columnName} AS VARCHAR)`;
        }
    }

    /**
     * Generate database-specific LIKE query
     */
    private generateLikeQuery(columnName: string, paramName: string, isNegated: boolean = false, isCaseInsensitive: boolean = false): string {
        const negation = isNegated ? 'NOT ' : '';

        // Convert to text if explicitly requested or if doing case-insensitive search on non-PostgreSQL
        const textColumn = this.convertToText(columnName);
        if (isCaseInsensitive) {
            return `LOWER(${textColumn}) ${negation}LIKE LOWER(:${paramName})`;
        } else {
            // Standard LIKE for case-sensitive matching
            return `${textColumn} ${negation}LIKE :${paramName}`;
        }
    }

    /**
     * Builds the where condition and applies it to the query builder
     * @returns The modified SelectQueryBuilder with where conditions applied
     */
    build(whereObject: WhereOptions) {
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
        const { query, params } = this.buildWhereQueryAndParams(whereObject);

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
        condition: WhereObject
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
                    const { query, params: subParams } = this.buildWhereQueryAndParams(sub);
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
            }
            // Handle comparison operators ($eq, $gt, $lt, etc.)
            else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                for (const op in value) {
                    const column = this.helper.getFieldWithAlias(key);
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
                const column = this.helper.getFieldWithAlias(key);
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

        switch (operator) {
            // Equality operators
            case WhereOperatorEnum.EQ:
                return {
                    query: `${columnName} = :${paramName}`,
                    params: { [paramName]: value }
                };
            case WhereOperatorEnum.NOT_EQ:
                return {
                    query: `${columnName} != :${paramName}`,
                    params: { [paramName]: value }
                };

            // Comparison operators
            case WhereOperatorEnum.GT:
                return {
                    query: `${columnName} > :${paramName}`,
                    params: { [paramName]: value }
                };
            case WhereOperatorEnum.GT_OR_EQ:
                return {
                    query: `${columnName} >= :${paramName}`,
                    params: { [paramName]: value }
                };
            case WhereOperatorEnum.LT:
                return {
                    query: `${columnName} < :${paramName}`,
                    params: { [paramName]: value }
                };
            case WhereOperatorEnum.LT_OR_EQ:
                return {
                    query: `${columnName} <= :${paramName}`,
                    params: { [paramName]: value }
                };

            // Pattern matching operators - now database-agnostic
            case WhereOperatorEnum.LIKE:
                return {
                    query: this.generateLikeQuery(columnName, paramName, false, false),
                    params: { [paramName]: value }
                };
            case WhereOperatorEnum.NOT_LIKE:
                return {
                    query: this.generateLikeQuery(columnName, paramName, true, false),
                    params: { [paramName]: value }
                };
            case WhereOperatorEnum.ILIKE:
                return {
                    query: this.generateLikeQuery(columnName, paramName, false, true),
                    params: { [paramName]: value }
                };
            case WhereOperatorEnum.NOT_ILIKE:
                return {
                    query: this.generateLikeQuery(columnName, paramName, true, true),
                    params: { [paramName]: value }
                };

            // Prefix/Suffix matching operators
            case WhereOperatorEnum.STARTS_WITH:
                return {
                    query: this.generateLikeQuery(columnName, paramName, false, false),
                    params: { [paramName]: `${value}%` }
                };
            case WhereOperatorEnum.ENDS_WITH:
                return {
                    query: this.generateLikeQuery(columnName, paramName, false, false),
                    params: { [paramName]: `%${value}` }
                };
            case WhereOperatorEnum.ISTARTS_WITH:
                return {
                    query: this.generateLikeQuery(columnName, paramName, false, true),
                    params: { [paramName]: `${value}%` }
                };
            case WhereOperatorEnum.IENDS_WITH:
                return {
                    query: this.generateLikeQuery(columnName, paramName, false, true),
                    params: { [paramName]: `%${value}` }
                };

            // Case-insensitive array operators
            case WhereOperatorEnum.IN_L:
                if (!Array.isArray(value)) {
                    throw new BadRequestException(`Operator ${operator} requires an array value`);
                }
                if (value.length === 0) {
                    return {
                        query: '1 = 0',
                        params: {}
                    }; // Always false for empty IN clause
                } else {
                    const textColumn = this.convertToText(columnName);
                    return {
                        query: `LOWER(${textColumn}) IN (:...${paramName})`,
                        params: { [paramName]: value.map((v: any) => String(v).toLowerCase()) }
                    };
                }
            case WhereOperatorEnum.NOT_IN_L:
                if (!Array.isArray(value)) {
                    throw new BadRequestException(`Operator ${operator} requires an array value`);
                }
                const textColumn = this.convertToText(columnName);
                return {
                    query: `LOWER(${textColumn}) NOT IN (:...${paramName})`,
                    params: { [paramName]: value.map((v: any) => String(v).toLowerCase()) }
                };

            // Array operators
            case WhereOperatorEnum.IN:
                if (Array.isArray(value) && value.length === 0) {
                    return {
                        query: '1 = 0',
                        params: {}
                    }; // Always false for empty IN clause
                } else {
                    return {
                        query: `${columnName} IN (:...${paramName})`,
                        params: { [paramName]: value }
                    };
                }
            case WhereOperatorEnum.NOT_IN:
                return {
                    query: `${columnName} NOT IN (:...${paramName})`,
                    params: { [paramName]: value }
                };

            // PostgreSQL array operators
            case WhereOperatorEnum.CONT_ARR:
                if (!Array.isArray(value)) {
                    throw new BadRequestException(`Operator ${operator} requires an array value`);
                }
                if (value.length === 0) {
                    return {
                        query: '1 = 0',
                        params: {}
                    }; // Always false for empty array
                }
                if (this.helper.dbType !== 'postgres' && this.helper.dbType !== 'postgresql') {
                    throw new BadRequestException(`Operator ${operator} is only supported for PostgreSQL`);
                }
                return {
                    query: `${columnName} @> ARRAY[:...${paramName}]::text[]`,
                    params: { [paramName]: value }
                };
            case WhereOperatorEnum.INTERSECTS_ARR:
                if (!Array.isArray(value)) {
                    throw new BadRequestException(`Operator ${operator} requires an array value`);
                }
                if (value.length === 0) {
                    return {
                        query: '1 = 0',
                        params: {}
                    }; // Always false for empty array
                }
                if (this.helper.dbType !== 'postgres' && this.helper.dbType !== 'postgresql') {
                    throw new BadRequestException(`Operator ${operator} is only supported for PostgreSQL`);
                }
                return {
                    query: `${columnName} && ARRAY[:...${paramName}]::text[]`,
                    params: { [paramName]: value }
                };

            // Null operators
            case WhereOperatorEnum.IS_NULL:
                return {
                    query: `${columnName} IS NULL`,
                    params: {}
                };
            case WhereOperatorEnum.IS_NOT_NULL:
                return {
                    query: `${columnName} IS NOT NULL`,
                    params: {}
                };

            // Range operators
            case WhereOperatorEnum.BETWEEN:
            case WhereOperatorEnum.NOT_BETWEEN: {
                const [start, end] = value as any;
                const isBetween = operator === WhereOperatorEnum.BETWEEN;
                return {
                    query: `${columnName} ${isBetween ? 'BETWEEN' : 'NOT BETWEEN'} :${paramName}_0 AND :${paramName}_1`,
                    params: {
                        [`${paramName}_0`]: start,
                        [`${paramName}_1`]: end,
                    }
                };
            }

            // Boolean operators
            case WhereOperatorEnum.IS_TRUE:
                return {
                    query: `${columnName} IS TRUE`,
                    params: {}
                };
            case WhereOperatorEnum.IS_FALSE:
                return {
                    query: `${columnName} IS FALSE`,
                    params: {}
                };

            default:
                throw new BadRequestException(`Unsupported operator: ${operator}`);
        }
    }
}
