export enum WhereLogicalOperatorEnum {
    AND = '$and',
    OR = '$or',
}

export enum WhereOperatorEnum {
    EQ = '$eq',
    NOT_EQ = '$ne',
    IEQ = '$ieq', // case-insensitive equality
    GT = '$gt',
    GT_OR_EQ = '$gte',
    LT = '$lt',
    LT_OR_EQ = '$lte',
    IN = '$in',
    NOT_IN = '$notIn',
    LIKE = '$like',
    NOT_LIKE = '$notLike',
    ILIKE = '$iLike',
    NOT_ILIKE = '$notIlike',
    STARTS_WITH = '$startsWith',
    ENDS_WITH = '$endsWith',
    ISTARTS_WITH = '$iStartsWith',
    IENDS_WITH = '$iEndsWith',
    IN_L = '$inL',
    NOT_IN_L = '$notinL',
    CONT_ARR = '$contArr', // postgres sql only array operators
    INTERSECTS_ARR = '$intersectsArr', // postgres sql only array operators
    IS_NULL = '$isNull',
    IS_NOT_NULL = '$isNotNull',
    BETWEEN = '$between',
    NOT_BETWEEN = '$notBetween',
    IS_TRUE = '$isTrue',
    IS_FALSE = '$isFalse',
    EXISTS = '$exists', // relation-existence: { posts: { $exists: true } }
    NOT_EXISTS = '$notExists', // relation-existence: { posts: { $notExists: true } }
}

export enum OrderDirectionEnum {
    ASC = 'ASC',
    DESC = 'DESC',
}

export type WhereObject = {
    [key: string]: any;
    $and?: WhereObject | WhereObject[];
    $or?: WhereObject | WhereObject[];
};

export type WhereOptions = WhereObject | WhereObject[];

export type RelationObjectValue = {
    select?: string[];
    where?: WhereObject | WhereObject[];
    joinType?: 'left' | 'inner';
};

export type RelationObject = Record<string, RelationObjectValue | boolean>;

export type RelationOptions = string | string[] | RelationObject;

export enum AggregateFnEnum {
    COUNT = 'count',
    SUM = 'sum',
    AVG = 'avg',
    MIN = 'min',
    MAX = 'max',
}

/**
 * A computed aggregate attached to each returned row, e.g.
 * `{ fn: 'count', field: 'posts.id', as: 'postCount' }`. `field` is a
 * relation-qualified path; `as` must be a safe identifier and is what
 * `having` / `order` reference. Mirrors the server `AggregateSpec`.
 */
export interface AggregateSpec {
    fn: AggregateFnEnum | 'count' | 'sum' | 'avg' | 'min' | 'max';
    field: string;
    as: string;
    distinct?: boolean;
    /** Optional filter on the related rows — same operator syntax as `where`. */
    where?: WhereOptions;
}

// QueryBuilderOptions is specific to nest-crud-request
export interface QueryBuilderOptions {
    [key: string]: any;
    select?: string[] | string;
    relations?: RelationOptions | string;
    where?: WhereOptions | string;
    order?: Record<string, OrderDirectionEnum> | string;
    aggregates?: AggregateSpec[] | string;
    having?: WhereOptions | string;
    skip?: number;
    take?: number;
    withDeleted?: boolean;
    onlyDeleted?: boolean;
}

export type FindManyResponse<T> = { items: T[]; total: number };
export type FindAllResponse<T> = T[];
