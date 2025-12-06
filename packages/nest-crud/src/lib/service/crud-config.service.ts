import deepmerge from 'deepmerge';

import { CrudActionsEnum, CrudOptions } from '../interface/crud';
import { RequestMethod } from '@nestjs/common';


export class CrudConfigService {

    static config: Partial<CrudOptions> = {
        routes: {
            findMany: {
                path: '/',
                method: RequestMethod.GET,
                enabled: true,
                interceptors: [],
                decorators: [],
            },
            findOne: {
                path: '/:id',
                method: RequestMethod.GET,
                enabled: true,
                interceptors: [],
                decorators: [],
            },
            counts: {
                path: '/get/counts',
                method: RequestMethod.GET,
                enabled: true,
                interceptors: [],
                decorators: [],
            },
            create: {
                path: '/',
                method: RequestMethod.POST,
                enabled: true,
                interceptors: [],
                decorators: [],
            },
            createMany: {
                path: '/bulk',
                method: RequestMethod.POST,
                enabled: true,
                interceptors: [],
                decorators: [],
            },
            update: {
                path: '/:id',
                method: RequestMethod.PUT,
                enabled: true,
                interceptors: [],
                decorators: [],
            },
            updateMany: {
                path: '/bulk',
                method: RequestMethod.PUT,
                enabled: true,
                interceptors: [],
                decorators: [],
            },
            delete: {
                path: '/:id',
                method: RequestMethod.DELETE,
                enabled: true,
                interceptors: [],
                decorators: [],
            },
            deleteMany: {
                path: '/delete/bulk',
                method: RequestMethod.DELETE,
                enabled: true,
                interceptors: [],
                decorators: [],
            },
            deleteFromTrash: {
                path: '/:id/trash',
                method: RequestMethod.DELETE,
                enabled: true,
                interceptors: [],
                decorators: [],
            },
            deleteFromTrashMany: {
                path: '/trash/bulk',
                method: RequestMethod.DELETE,
                enabled: true,
                interceptors: [],
                decorators: [],
            },
            restore: {
                path: '/:id/restore',
                method: RequestMethod.PUT,
                enabled: true,
                interceptors: [],
                decorators: [],
            },
            restoreMany: {
                path: '/restore/bulk',
                method: RequestMethod.PUT,
                enabled: true,
                interceptors: [],
                decorators: [],
            },
            reorder: {
                path: '/reorder',
                method: RequestMethod.PUT,
                enabled: true,
                interceptors: [],
                decorators: [],
            },
        },
    };

    static load(config: Partial<CrudOptions> = {}) {
        CrudConfigService.config = deepmerge(
            CrudConfigService.config,
            config,
            { arrayMerge: (_a, b, _c) => b },
        );
    }

}
