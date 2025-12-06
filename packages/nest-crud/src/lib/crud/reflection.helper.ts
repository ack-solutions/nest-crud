import { ArgumentsHost } from '@nestjs/common';
import {
    INTERCEPTORS_METADATA,
    METHOD_METADATA,
    PARAMTYPES_METADATA,
    PATH_METADATA,
    ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';

import {
    CRUD_OPTIONS_METADATA,
    CRUD_AUTH_OPTIONS_METADATA,
    CRUD_ACTION_METADATA,
} from '../constants';
import { CrudActionsEnum, CrudOptions, RouteOptions } from '../interface/crud';
import { isFunction } from '../utils';


export class R {

    static set(metadataKey: any, metadataValue: any, target: any, propertyKey?: string | symbol) {
        if (!target) {
            return;
        }

        if (propertyKey) {
            Reflect.defineMetadata(metadataKey, metadataValue, target, propertyKey);
        } else {
            Reflect.defineMetadata(metadataKey, metadataValue, target);
        }
    }

    static get<T>(metadataKey: any, target: any, propertyKey?: string | symbol): T {
        return propertyKey
            ? Reflect.getMetadata(metadataKey, target, propertyKey)
            : Reflect.getMetadata(metadataKey, target);
    }

    static createRouteArg(
        paramType: RouteParamtypes,
        index: number,
        /* istanbul ignore next */
        pipes: any[] = [],
        data: any = undefined,
    ): any {
        return {
            [`${paramType}:${index}`]: {
                index,
                pipes,
                data,
            },
        };
    }

    static setDecorators(decorators: (PropertyDecorator | MethodDecorator)[], target: any, name: string) {
        // this makes metadata decorator works
        const decoratedDescriptor = Reflect.decorate(
            decorators,
            target,
            name,
            Reflect.getOwnPropertyDescriptor(target, name),
        );

        // this makes proxy decorator works
        Reflect.defineProperty(target, name, decoratedDescriptor);
    }


    static setQueryArg(index: number, /* istanbul ignore next */ pipes: any[] = []) {
        return R.createRouteArg(RouteParamtypes.QUERY, index, pipes);
    }

    static setParamsArg(name: string, index: number, /* istanbul ignore next */ pipes: any[] = []) {
        return R.createRouteArg(RouteParamtypes.PARAM, index, pipes, name);
    }

    static setBodyArg(index: number, /* istanbul ignore next */ pipes: any[] = []) {
        return R.createRouteArg(RouteParamtypes.BODY, index, pipes);
    }

    static setCrudOptions(options: CrudOptions, target: any) {
        R.set(CRUD_OPTIONS_METADATA, options, target);
    }

    static setRoute(route: RouteOptions, target: any) {
        if (!target) {
            return;
        }

        const { path, method } = route;

        // Ensure target is an object before setting metadata
        if (typeof target === 'function' || (typeof target === 'object' && target !== null)) {
            R.set(PATH_METADATA, path, target);
            R.set(METHOD_METADATA, method, target);
        }
    }

    static setInterceptors(interceptors: any[], func: unknown) {
        R.set(INTERCEPTORS_METADATA, interceptors, func);
    }

    static setRouteArgs(metadata: any, target: any, name: string) {
        R.set(ROUTE_ARGS_METADATA, metadata, target, name);
    }

    static setRouteArgsTypes(metadata: any, target: any, name: string) {
        R.set(PARAMTYPES_METADATA, metadata, target, name);
    }

    static setCrudAuthOptions(metadata: any, target: any) {
        R.set(CRUD_AUTH_OPTIONS_METADATA, metadata, target);
    }


    static getCrudOptions(target: any): CrudOptions {
        return R.get(CRUD_OPTIONS_METADATA, target);
    }


    static getInterceptors(func: unknown): any[] {
        return R.get(INTERCEPTORS_METADATA, func) || [];
    }

    static getRouteArgs(target: any, name: string): any {
        return R.get(ROUTE_ARGS_METADATA, target, name);
    }

    static getRouteArgsTypes(target: any, name: string): any[] {
        return R.get(PARAMTYPES_METADATA, target, name) || /* istanbul ignore next */[];
    }

    static getContextRequest(ctx: ArgumentsHost): any {
        return isFunction(ctx.switchToHttp) ? ctx.switchToHttp().getRequest() : /* istanbul ignore next */ ctx;
    }


    /*
    * Stores metadata in two places:
    * 1. On the prototype with property key (for compatibility)
    * 2. Directly on the handler function (for easy access via getAction)
    *
    * @param action - The CRUD action name (e.g., 'findMany', 'create', etc.)
    * @param target - The target class prototype
    * @param propertyKey - The method name (property key)
    * @param handler - The handler function (optional, for direct metadata storage)
    */
    static setCrudAction(action: CrudActionsEnum, target: any, propertyKey: string | symbol, handler?: any): void {
        R.set(CRUD_ACTION_METADATA, action, target, propertyKey);

        if (handler && typeof handler === 'function') {
            R.set(CRUD_ACTION_METADATA, action, handler);
        }
    }


    /**
     * Gets the CRUD action name directly from a handler function
     *
     * This is the preferred way to get the action as it's simpler and works
     * even when you only have access to the handler function.
     *
     * @param handler - The handler function
     * @returns The CRUD action name, or undefined if not set
     */
    static getActionFromHandler(handler: any): CrudActionsEnum | undefined {
        if (!handler || typeof handler !== 'function') {
            return undefined;
        }
        return R.get<CrudActionsEnum>(CRUD_ACTION_METADATA, handler);
    }

}
