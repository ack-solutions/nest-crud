import {
    OrderDirectionEnum,
    RelationOptions,
    WhereOptions
} from '../types';
import { CanActivate, NestInterceptor, RequestMethod, Type, ValidationPipeOptions } from '@nestjs/common';


type Guard = Type<CanActivate> | CanActivate | ((...args: any[]) => CanActivate);
type Interceptor = Type<NestInterceptor> | NestInterceptor<any, any> | ((...args: any[]) => NestInterceptor<any, any>);
type CrudDecorator = PropertyDecorator | MethodDecorator;

export interface RouteOptions {
    path: string;
    method: RequestMethod;
    enabled?: boolean;
    guards?: Guard[];
    interceptors?: Interceptor[];
    decorators?: CrudDecorator[];
}

export type RouteOptionsWithName = RouteOptions & { name: CrudActionsEnum };

export type CrudRoutesOptions = Record<CrudActionsEnum, Partial<RouteOptions> | boolean>;

export interface CrudQueryOptions {
    relations?: string[];
}

/**
 * Customisable response messages (i18n). Any omitted key falls back to the
 * English default. Set globally via `CrudConfigService.load({ messages })`.
 */
export interface CrudMessages {
    deleted?: string;
    noItemsToDelete?: string;
    restored?: string;
    reordered?: string;
}

export interface CrudOptions {
    debug?: boolean;
    name?: string;
    path?: string;
    select?: string[];
    hiddenFields?: string[];
    /**
     * Maximum allowed `take` / `limit` per request for list queries (findMany and counts filter).
     * When omitted, uses `CrudConfigService.config.maxPageSize` or 5000.
     */
    maxPerPage?: number;
    maxPageSize?: number;
    query?: CrudQueryOptions;
    entity: any;
    routes?: Partial<CrudRoutesOptions>;
    softDelete?: boolean;
    /** Override delete/restore/reorder response messages (i18n). */
    messages?: CrudMessages;
    validation?: ValidationPipeOptions;
    dto?: {
        create?: any;
        update?: any;
    };
}

export interface PaginationResponse<T> {
    items: T[];
    total: number;
}

export type ListResponse<T> = PaginationResponse<T>;

export type FindAllResponse<T> = T[];

export enum CrudValidationGroupsEnum {
    CREATE = 'create',
    UPDATE = 'update',
}

export enum CrudActionsEnum {
    FIND_ALL = 'findAll',
    FIND_MANY = 'findMany',
    COUNTS = 'counts',
    FIND_ONE = 'findOne',
    CREATE = 'create',
    CREATE_MANY = 'createMany',
    UPDATE = 'update',
    UPDATE_MANY = 'updateMany',
    DELETE = 'delete',
    DELETE_MANY = 'deleteMany',
    DELETE_FROM_TRASH = 'deleteFromTrash',
    DELETE_FROM_TRASH_MANY = 'deleteFromTrashMany',
    RESTORE = 'restore',
    RESTORE_MANY = 'restoreMany',
    REORDER = 'reorder',
}


export interface IFindManyOptions {
    relations?: RelationOptions;
    skip?: number;
    offset?: number;
    take?: number;
    order?: Record<string, OrderDirectionEnum>;
    where?: WhereOptions;
    select?: string[];
    onlyDeleted?: boolean;
    withDeleted?: boolean;
    [extraQueryParams: string]: any;
}

export interface IFindOneOptions {
    relations?: string[];
    select?: string[];
    [extraQueryParams: string]: any;
}

export interface ICountsRequest {
    filter: IFindManyOptions;
    groupByKey?: string | string[];
    [extraQueryParams: string]: any;
}

export interface ICountsResult {
    total: number;
    data?: Array<{ count: number } & Record<string, any>>;
}

export interface IDeleteManyOptions {
    ids?: string[];
    [extraQueryParams: string]: any;
}
