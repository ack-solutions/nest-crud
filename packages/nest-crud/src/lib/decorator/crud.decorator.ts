import { Controller } from '@nestjs/common';

import { CrudRoutesFactory } from '../crud/crud-routes.factory';
import { CrudOptions } from '../interface/crud';


export const Crud = (options: CrudOptions) => (target: any): void => {
    const name = options.name || options.entity?.name || target.name;
    Controller(options.path || name)(target);
    CrudRoutesFactory.create(target, options);
};
