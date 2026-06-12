import { BadRequestException } from '@nestjs/common';

/**
 * Everything a WHERE/HAVING operator handler needs to emit a SQL fragment.
 * `column` is the already-resolved, quoted left-hand expression; `param` is a
 * pre-allocated, collision-free parameter name; `value` is the raw RHS.
 */
export interface WhereOperatorContext {
    /** Resolved + quoted left-hand expression (e.g. `"User"."name"` or `t."postCount"`). */
    column: string;
    /** Raw right-hand value from the query. */
    value: any;
    /** Pre-allocated unique parameter name (no leading `:`). */
    param: string;
    /** The operator key being handled (for error messages). */
    operator: string;
    /** Connection driver type (`postgres`, `sqlite`, `mysql`, …) for dialect choices. */
    dbType: string;
}

/** A handler turns an operator context into a SQL fragment + its bound parameters. */
export type WhereOperatorHandler = (ctx: WhereOperatorContext) => { query: string; params: Record<string, any> };

/**
 * Wrap a column in a dialect-specific CAST to text (used by LIKE / case-insensitive ops).
 */
export function convertToText(columnName: string, dbType: string): string {
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
            return `CAST(${columnName} AS VARCHAR)`;
    }
}

/**
 * Build a dialect-aware LIKE expression. Case-insensitive matching is done with
 * `LOWER(...)` on both sides so it works the same on every engine.
 */
export function generateLikeQuery(
    columnName: string,
    paramName: string,
    dbType: string,
    isNegated = false,
    isCaseInsensitive = false,
): string {
    const negation = isNegated ? 'NOT ' : '';
    const textColumn = convertToText(columnName, dbType);
    return isCaseInsensitive
        ? `LOWER(${textColumn}) ${negation}LIKE LOWER(:${paramName})`
        : `${textColumn} ${negation}LIKE :${paramName}`;
}

function requireArray(value: any, operator: string): void {
    if (!Array.isArray(value)) {
        throw new BadRequestException(`Operator ${operator} requires an array value`);
    }
}

function requirePostgres(dbType: string, operator: string): void {
    if (dbType !== 'postgres' && dbType !== 'postgresql') {
        throw new BadRequestException(`Operator ${operator} is only supported for PostgreSQL`);
    }
}

/**
 * Registry of WHERE/HAVING comparison operators, keyed by operator token (`$eq`, …).
 *
 * Consumers can add their own operators without forking the library:
 * ```ts
 * import { WhereOperatorRegistry } from '@ackplus/nest-crud';
 * WhereOperatorRegistry.register('$regex', ({ column, value, param }) => ({
 *     query: `${column} ~ :${param}`,
 *     params: { [param]: value },
 * }));
 * ```
 * Then `where: { name: { $regex: '^A' } }` just works. Relation-level operators
 * (`$exists` / `$notExists`) are handled by the where builder, not here.
 */
export class WhereOperatorRegistry {
    private static handlers = new Map<string, WhereOperatorHandler>();

    /** Register (or override) a handler for an operator token. */
    static register(operator: string, handler: WhereOperatorHandler): void {
        this.handlers.set(operator, handler);
    }

    /** Remove a previously-registered operator (e.g. a custom one). Returns true if it existed. */
    static unregister(operator: string): boolean {
        return this.handlers.delete(operator);
    }

    static get(operator: string): WhereOperatorHandler | undefined {
        return this.handlers.get(operator);
    }

    static has(operator: string): boolean {
        return this.handlers.has(operator);
    }

    /** All registered operator tokens (built-in + custom). */
    static operators(): string[] {
        return Array.from(this.handlers.keys());
    }
}

const between = (isBetween: boolean): WhereOperatorHandler => ({ column, value, param, operator }) => {
    if (!Array.isArray(value) || value.length !== 2) {
        throw new BadRequestException(`Operator ${operator} requires a [start, end] array value`);
    }
    const [start, end] = value;
    return {
        query: `${column} ${isBetween ? 'BETWEEN' : 'NOT BETWEEN'} :${param}_0 AND :${param}_1`,
        params: { [`${param}_0`]: start, [`${param}_1`]: end },
    };
};

// ---- Built-in operators (behaviour-identical to the previous switch) ----
const builtins: Record<string, WhereOperatorHandler> = {
    // Equality
    $eq: ({ column, value, param }) => ({ query: `${column} = :${param}`, params: { [param]: value } }),
    $ne: ({ column, value, param }) => ({ query: `${column} != :${param}`, params: { [param]: value } }),
    // Case-insensitive equality (v2.1)
    $ieq: ({ column, value, param, dbType }) => ({
        query: `LOWER(${convertToText(column, dbType)}) = LOWER(:${param})`,
        params: { [param]: value },
    }),

    // Comparison
    $gt: ({ column, value, param }) => ({ query: `${column} > :${param}`, params: { [param]: value } }),
    $gte: ({ column, value, param }) => ({ query: `${column} >= :${param}`, params: { [param]: value } }),
    $lt: ({ column, value, param }) => ({ query: `${column} < :${param}`, params: { [param]: value } }),
    $lte: ({ column, value, param }) => ({ query: `${column} <= :${param}`, params: { [param]: value } }),

    // Pattern matching
    $like: ({ column, param, value, dbType }) => ({ query: generateLikeQuery(column, param, dbType, false, false), params: { [param]: value } }),
    $notLike: ({ column, param, value, dbType }) => ({ query: generateLikeQuery(column, param, dbType, true, false), params: { [param]: value } }),
    $iLike: ({ column, param, value, dbType }) => ({ query: generateLikeQuery(column, param, dbType, false, true), params: { [param]: value } }),
    $notIlike: ({ column, param, value, dbType }) => ({ query: generateLikeQuery(column, param, dbType, true, true), params: { [param]: value } }),

    // Prefix / suffix
    $startsWith: ({ column, param, value, dbType }) => ({ query: generateLikeQuery(column, param, dbType, false, false), params: { [param]: `${value}%` } }),
    $endsWith: ({ column, param, value, dbType }) => ({ query: generateLikeQuery(column, param, dbType, false, false), params: { [param]: `%${value}` } }),
    $iStartsWith: ({ column, param, value, dbType }) => ({ query: generateLikeQuery(column, param, dbType, false, true), params: { [param]: `${value}%` } }),
    $iEndsWith: ({ column, param, value, dbType }) => ({ query: generateLikeQuery(column, param, dbType, false, true), params: { [param]: `%${value}` } }),

    // Case-insensitive IN / NOT IN
    $inL: ({ column, value, param, operator, dbType }) => {
        requireArray(value, operator);
        if (value.length === 0) {
            return { query: '1 = 0', params: {} };
        }
        return { query: `LOWER(${convertToText(column, dbType)}) IN (:...${param})`, params: { [param]: value.map((v: any) => String(v).toLowerCase()) } };
    },
    $notinL: ({ column, value, param, operator, dbType }) => {
        requireArray(value, operator);
        if (value.length === 0) {
            return { query: '1 = 1', params: {} };
        }
        return { query: `LOWER(${convertToText(column, dbType)}) NOT IN (:...${param})`, params: { [param]: value.map((v: any) => String(v).toLowerCase()) } };
    },

    // IN / NOT IN
    $in: ({ column, value, param, operator }) => {
        requireArray(value, operator);
        if (value.length === 0) {
            return { query: '1 = 0', params: {} };
        }
        return { query: `${column} IN (:...${param})`, params: { [param]: value } };
    },
    $notIn: ({ column, value, param, operator }) => {
        requireArray(value, operator);
        if (value.length === 0) {
            return { query: '1 = 1', params: {} };
        }
        return { query: `${column} NOT IN (:...${param})`, params: { [param]: value } };
    },

    // PostgreSQL array operators
    $contArr: ({ column, value, param, operator, dbType }) => {
        requireArray(value, operator);
        if (value.length === 0) {
            return { query: '1 = 0', params: {} };
        }
        requirePostgres(dbType, operator);
        return { query: `${column} @> ARRAY[:...${param}]::text[]`, params: { [param]: value } };
    },
    $intersectsArr: ({ column, value, param, operator, dbType }) => {
        requireArray(value, operator);
        if (value.length === 0) {
            return { query: '1 = 0', params: {} };
        }
        requirePostgres(dbType, operator);
        return { query: `${column} && ARRAY[:...${param}]::text[]`, params: { [param]: value } };
    },

    // Null
    $isNull: ({ column }) => ({ query: `${column} IS NULL`, params: {} }),
    $isNotNull: ({ column }) => ({ query: `${column} IS NOT NULL`, params: {} }),

    // Range
    $between: between(true),
    $notBetween: between(false),

    // Boolean
    $isTrue: ({ column }) => ({ query: `${column} IS TRUE`, params: {} }),
    $isFalse: ({ column }) => ({ query: `${column} IS FALSE`, params: {} }),
};

for (const [operator, handler] of Object.entries(builtins)) {
    WhereOperatorRegistry.register(operator, handler);
}
