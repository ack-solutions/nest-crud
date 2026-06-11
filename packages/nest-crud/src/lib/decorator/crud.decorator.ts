import { Controller } from '@nestjs/common';

import { CrudRoutesFactory } from '../crud/crud-routes.factory';
import { CrudOptions } from '../interface/crud';
import { addHiddenField } from './crud-hidden.decorator';


export const Crud = (options: CrudOptions) => (target: any): void => {
    const name = options.name || options.entity?.name || target.name;

    // Per-controller `hiddenFields` feed the same per-entity hidden set the
    // `@CrudHidden()` decorator uses, so enforcement is unified in the query layer.
    if (options.entity && Array.isArray(options.hiddenFields)) {
        for (const field of options.hiddenFields) {
            addHiddenField(options.entity, field);
        }
    }

    Controller(options.path || name)(target);
    CrudRoutesFactory.create(target, options);
};
