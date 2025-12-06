import { HttpStatus } from '@nestjs/common';
import { DECORATORS } from '@nestjs/swagger/dist/constants';
import { getSchemaPath, ApiProperty } from '@nestjs/swagger';
import { R } from './reflection.helper';
import { CrudActionsEnum } from '../interface/crud';
import { objKeys } from '../utils';


const pluralize = require('pluralize');

/**
 * Reusable Swagger response model classes for optimization
 * These models are registered once and reused across all CRUD operations
 */

export class PaginationResponseDto<T = any> {
    @ApiProperty({
        type: () => Object,
        isArray: true,
        description: 'Array of items matching the query',
    })
    items: T[];

    @ApiProperty({
        type: 'number',
        description: 'Total number of items matching the query',
        example: 100,
    })
    total: number;
}

export class CountsResponseDto {
    @ApiProperty({
        type: 'number',
        description: 'Total count of all matching items',
        example: 100,
    })
    total: number;

    @ApiProperty({
        type: 'array',
        description: 'Array of count objects with specific filters (only present when groupByKey is used)',
        required: false,
    })
    data?: Array<{ count: number } & Record<string, any>>;
}

export class ErrorResponseDto {
    @ApiProperty({
        description: 'Error message. Can be a string, array of strings, or object with field names as keys (for validation errors)',
        oneOf: [
            { type: 'string', example: 'Unauthorized' },
            { type: 'array', items: { type: 'string' }, example: ['Error 1', 'Error 2'] },
            {
                type: 'object',
                additionalProperties: { type: 'array', items: { type: 'string' } },
                example: { field: ['Error message'] },
            },
        ],
    } as any)
    message: string | string[] | Record<string, string[]>;

    @ApiProperty({
        type: 'string',
        description: 'Error title',
        example: 'Unauthorized',
        required: false,
    })
    error?: string;
}

export class ValidationErrorResponseDto extends ErrorResponseDto {
    @ApiProperty({
        description: 'Validation error messages. Can be an array of error strings (default ValidationPipe), a single string (custom BadRequestException), or an object with field names as keys (custom exception factory)',
        oneOf: [
            { type: 'string', example: 'id must be a UUID' },
            {
                type: 'array',
                items: { type: 'string' },
                example: ['email must be an email', 'name should not be empty'],
            },
            {
                type: 'object',
                additionalProperties: {
                    type: 'array',
                    items: { type: 'string' },
                },
                example: {
                    email: ['email must be an email'],
                    name: ['name should not be empty'],
                },
            },
        ],
    } as any)
    declare message: string | string[] | Record<string, string[]>;
}

export class MessageResponseDto {
    @ApiProperty({
        type: 'string',
        description: 'Success message',
        example: 'Successfully deleted',
    })
    message: string;
}

export class SuccessMessageResponseDto {
    @ApiProperty({
        type: 'boolean',
        description: 'Whether the operation was successful',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        type: 'string',
        description: 'Success message',
        example: 'Successfully restored',
    })
    message: string;
}


export class Swagger {

    static operationsMap(modelName: string): { [key in CrudActionsEnum]: string } {
        return {
            [CrudActionsEnum.FIND_MANY]: `Retrieve multiple ${pluralize(modelName)}`,
            [CrudActionsEnum.FIND_ONE]: `Retrieve a single ${modelName}`,
            [CrudActionsEnum.COUNTS]: `Retrieve counts of ${pluralize(modelName)}`,
            [CrudActionsEnum.CREATE]: `Create a single ${modelName}`,
            [CrudActionsEnum.CREATE_MANY]: `Create multiple ${pluralize(modelName)}`,
            [CrudActionsEnum.UPDATE]: `Update a single ${modelName}`,
            [CrudActionsEnum.UPDATE_MANY]: `Update multiple ${pluralize(modelName)}`,
            [CrudActionsEnum.DELETE]: `Delete a single ${modelName}`,
            [CrudActionsEnum.DELETE_MANY]: `Delete multiple ${pluralize(modelName)}`,
            [CrudActionsEnum.DELETE_FROM_TRASH]: `Delete a single ${modelName} from trash`,
            [CrudActionsEnum.DELETE_FROM_TRASH_MANY]: `Delete multiple ${pluralize(modelName)} from trash`,
            [CrudActionsEnum.RESTORE]: `Restore a single ${modelName}`,
            [CrudActionsEnum.RESTORE_MANY]: `Restore multiple ${pluralize(modelName)}`,
            [CrudActionsEnum.REORDER]: `Reorder ${pluralize(modelName)}`,
        };
    }

    static getOperationTags(modelName: string): string[] {
        // Convert kebab-case, snake_case, or camelCase to Title Case
        // e.g., 'crud-testing' -> 'Crud Testing', 'user_profile' -> 'User Profile', 'userProfile' -> 'User Profile'
        const formattedName = modelName
            .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
            .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space before capital letters (camelCase)
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        return [formattedName];
    }

    static setOperation(metadata: unknown, func: any): void {
        /* istanbul ignore else */
        if (DECORATORS) {
            R.set(DECORATORS.API_OPERATION, metadata, func);
        }
    }

    static setParams(metadata: unknown, func: any): void {
        /* istanbul ignore else */
        if (DECORATORS) {
            R.set(DECORATORS.API_PARAMETERS, metadata, func);
        }
    }

    static setExtraModels(swaggerModels: any): void {
        /* istanbul ignore else */
        if (DECORATORS) {
            const meta = Swagger.getExtraModels(swaggerModels.get);

            // Register reusable response models for optimization
            const reusableModels = [
                PaginationResponseDto,
                CountsResponseDto,
                MessageResponseDto,
                SuccessMessageResponseDto,
                ErrorResponseDto,
                ValidationErrorResponseDto,
            ];

            const models: any[] = [
                ...meta,
                ...reusableModels.filter(model => !meta.includes(model)),
                ...objKeys(swaggerModels)
                    .map((name) => swaggerModels[name])
                    .filter((one) => one && one.name !== swaggerModels.get.name),
            ];
            R.set(DECORATORS.API_EXTRA_MODELS, models, swaggerModels.get);
        }
    }

    static setResponseOk(metadata: unknown, func: any): void {
        /* istanbul ignore else */
        if (DECORATORS) {
            R.set(DECORATORS.API_RESPONSE, metadata, func);
        }
    }

    static getOperation(func: any): any {
        /* istanbul ignore next */
        return DECORATORS ? R.get(DECORATORS.API_OPERATION, func) || {} : {};
    }

    static getParams(func: any): any[] {
        /* istanbul ignore next */
        return DECORATORS ? R.get(DECORATORS.API_PARAMETERS, func) || [] : [];
    }

    static getExtraModels(target: unknown): any[] {
        /* istanbul ignore next */
        return DECORATORS ? R.get(DECORATORS.API_EXTRA_MODELS, target) || [] : [];
    }

    static getResponseOk(func: any): any {
        /* istanbul ignore next */
        return DECORATORS ? R.get(DECORATORS.API_RESPONSE, func) || {} : {};
    }

    static getControllerTags(controller: any): string[] {
        /* istanbul ignore next */
        if (DECORATORS) {
            return R.get(DECORATORS.API_TAGS, controller) || [];
        }
        return [];
    }

    static setControllerTags(tags: string[], controller: any): void {
        /* istanbul ignore else */
        if (DECORATORS && tags && tags.length > 0) {
            R.set(DECORATORS.API_TAGS, tags, controller);
        }
    }

    /**
     * Creates common error response schemas for Swagger with proper examples
     * Based on NestJS default error response format
     */
    static getCommonErrorResponses(includeNotFound: boolean = false, includeValidation: boolean = false): Record<number, any> {
        const errors: Record<number, any> = {
            [HttpStatus.UNAUTHORIZED]: {
                description: 'Unauthorized - Authentication required or token is invalid',
                schema: getSchemaPath ? { $ref: getSchemaPath(ErrorResponseDto) } : undefined,
                example: {
                    message: 'Unauthorized',
                    error: 'Unauthorized',
                },
            },
            [HttpStatus.FORBIDDEN]: {
                description: 'Forbidden - User does not have permission to access this resource',
                schema: getSchemaPath ? { $ref: getSchemaPath(ErrorResponseDto) } : undefined,
                example: {
                    message: 'Forbidden resource',
                    error: 'Forbidden',
                },
            },
            [HttpStatus.INTERNAL_SERVER_ERROR]: {
                description: 'Internal Server Error - An unexpected error occurred on the server',
                schema: getSchemaPath ? { $ref: getSchemaPath(ErrorResponseDto) } : undefined,
                example: {
                    message: 'Internal server error',
                    error: 'Internal Server Error',
                },
            },
        };

        // Bad Request - Can be validation errors (array/object) or general error (string)
        if (includeValidation) {
            errors[HttpStatus.BAD_REQUEST] = {
                description: 'Bad Request - Validation failed. Message can be an array of errors (default ValidationPipe), an object with field names as keys (custom exception factory), or a string (custom BadRequestException)',
                schema: getSchemaPath ? { $ref: getSchemaPath(ValidationErrorResponseDto) } : undefined,
                examples: {
                    'Validation Errors (Array)': {
                        summary: 'Multiple validation errors (default ValidationPipe format)',
                        description: 'Response when multiple fields fail validation - default ValidationPipe returns array',
                        value: {
                            message: [
                                'email must be an email',
                                'name should not be empty',
                                'age must be a number',
                            ],
                        },
                    },
                    'Validation Errors (Object)': {
                        summary: 'Validation errors grouped by field (custom exception factory)',
                        description: 'Response when using custom exception factory that formats errors by field name',
                        value: {
                            message: {
                                email: ['email must be an email'],
                                name: ['name should not be empty', 'name must be longer than or equal to 3 characters'],
                                age: ['age must be a number', 'age must not be less than 0'],
                            },
                        },
                    },
                    'Single Validation Error': {
                        summary: 'Single validation error',
                        description: 'Response when a single field fails validation',
                        value: {
                            message: ['id must be a UUID'],
                        },
                    },
                    'Custom BadRequestException': {
                        summary: 'Custom bad request error (string)',
                        description: 'Response for custom BadRequestException with string message',
                        value: {
                            message: 'Invalid request data',
                            error: 'Bad Request',
                        },
                    },
                },
            };
        } else {
            errors[HttpStatus.BAD_REQUEST] = {
                description: 'Bad Request - Invalid request parameters or query string',
                schema: getSchemaPath ? { $ref: getSchemaPath(ErrorResponseDto) } : undefined,
                example: {
                    message: 'Invalid request parameters',
                    error: 'Bad Request',
                },
            };
        }

        if (includeNotFound) {
            errors[HttpStatus.NOT_FOUND] = {
                description: 'Not Found - The requested resource does not exist',
                schema: getSchemaPath ? { $ref: getSchemaPath(ErrorResponseDto) } : undefined,
                example: {
                    message: 'Resource not found',
                    error: 'Not Found',
                },
            };
        }

        return errors;
    }

    /**
     * Creates Swagger response metadata using inline schemas
     * No need for complex DTO classes - just use entity types directly
     * Includes common error responses (400, 401, 403, 404, 500) based on method needs
     */
    static createResponseMeta(name: CrudActionsEnum, entityType: any): any {
        /* istanbul ignore else */
        if (DECORATORS && getSchemaPath) {
            // Ensure entityType is valid and has a name before creating schema reference
            const isValidEntityType = entityType && typeof entityType === 'function' && entityType.name;
            const entitySchema = isValidEntityType ? { $ref: getSchemaPath(entityType) } : undefined;

            // Methods that use ID parameter (need 404)
            const methodsWithId = [
                CrudActionsEnum.FIND_ONE,
                CrudActionsEnum.UPDATE,
                CrudActionsEnum.DELETE,
                CrudActionsEnum.DELETE_FROM_TRASH,
                CrudActionsEnum.RESTORE,
            ];

            // Methods that accept body (need 400 for validation)
            const methodsWithBody = [
                CrudActionsEnum.CREATE,
                CrudActionsEnum.CREATE_MANY,
                CrudActionsEnum.UPDATE,
                CrudActionsEnum.UPDATE_MANY,
                CrudActionsEnum.RESTORE_MANY,
                CrudActionsEnum.REORDER,
            ];

            const includeNotFound = methodsWithId.includes(name);
            const includeValidation = methodsWithBody.includes(name);

            // Get common error responses with validation format when needed
            const errorResponses = Swagger.getCommonErrorResponses(includeNotFound, includeValidation);

            let successResponse: Record<number, any> = {};

            switch (name) {
                case CrudActionsEnum.FIND_ONE:
                    // findOne returns entity directly - use entity schema reference
                    successResponse = {
                        [HttpStatus.OK]: {
                            description: 'Successfully retrieved the item',
                            schema: isValidEntityType ? entitySchema : undefined,
                            type: isValidEntityType ? entityType : undefined,
                        },
                    };
                    break;

                case CrudActionsEnum.FIND_MANY:
                    // findMany returns { items: T[], total: number }
                    // Use inline schema with explicit properties to ensure both items and total are visible
                    // The items array includes entity schema reference for proper entity typing
                    successResponse = {
                        [HttpStatus.OK]: {
                            description: 'Successfully retrieved items with pagination',
                            schema: isValidEntityType
                                ? {
                                    type: 'object',
                                    properties: {
                                        items: {
                                            type: 'array',
                                            items: entitySchema,
                                            description: 'Array of items matching the query',
                                        },
                                        total: {
                                            type: 'number',
                                            description: 'Total number of items matching the query',
                                            example: 100,
                                        },
                                    },
                                    required: ['items', 'total'],
                                    additionalProperties: false,
                                }
                                : (getSchemaPath ? { $ref: getSchemaPath(PaginationResponseDto) } : undefined),
                            type: isValidEntityType ? undefined : PaginationResponseDto,
                        },
                    };
                    break;

                case CrudActionsEnum.COUNTS:
                    // counts returns { total: number, data?: Array<{ count: number } & Record<string, any>> }
                    // Use reusable CountsResponseDto schema reference
                    successResponse = {
                        [HttpStatus.OK]: {
                            description: 'Successfully retrieved counts',
                            schema: getSchemaPath ? { $ref: getSchemaPath(CountsResponseDto) } : undefined,
                            type: CountsResponseDto,
                            examples: {
                                'Simple Count': {
                                    summary: 'Count without grouping',
                                    description: 'Response when groupByKey is not provided',
                                    value: {
                                        total: 100,
                                    },
                                },
                                'Grouped Count': {
                                    summary: 'Count with grouping',
                                    description: 'Response when groupByKey is provided',
                                    value: {
                                        total: 100,
                                        data: [
                                            { count: 25, status: 'active' },
                                            { count: 30, status: 'inactive' },
                                            { count: 45, status: 'pending' },
                                        ],
                                    },
                                },
                            },
                        },
                    };
                    break;

                case CrudActionsEnum.CREATE:
                case CrudActionsEnum.UPDATE:
                    // create and update return entity directly (T)
                    // Use type and schema - NestJS Swagger will generate schema from registered entity type
                    successResponse = {
                        [name === CrudActionsEnum.CREATE ? HttpStatus.CREATED : HttpStatus.OK]: {
                            description: name === CrudActionsEnum.CREATE
                                ? 'Successfully created the item'
                                : 'Successfully updated the item',
                            schema: isValidEntityType ? entitySchema : undefined,
                            type: isValidEntityType ? entityType : undefined,
                        },
                    };
                    break;

                case CrudActionsEnum.CREATE_MANY:
                case CrudActionsEnum.UPDATE_MANY:
                    // createMany and updateMany return T[] (array of entities)
                    // Use explicit schema with array and entity reference to ensure it's visible
                    successResponse = {
                        [name === CrudActionsEnum.CREATE_MANY ? HttpStatus.CREATED : HttpStatus.OK]: {
                            description: name === CrudActionsEnum.CREATE_MANY
                                ? 'Successfully created multiple items'
                                : 'Successfully updated multiple items',
                            schema: isValidEntityType
                                ? {
                                    type: 'array',
                                    items: entitySchema,
                                    description: 'Array of created/updated items',
                                }
                                : {
                                    type: 'array',
                                    items: { type: 'object' },
                                    description: 'Array of created/updated items',
                                },
                            type: isValidEntityType ? undefined : PaginationResponseDto,
                        },
                    };
                    break;

                case CrudActionsEnum.DELETE:
                case CrudActionsEnum.DELETE_MANY:
                    // delete and deleteMany return { message: string }
                    // Use reusable MessageResponseDto schema reference
                    const deleteMessages = {
                        [CrudActionsEnum.DELETE]: 'Successfully deleted the item',
                        [CrudActionsEnum.DELETE_MANY]: 'Delete operation completed',
                    };
                    successResponse = {
                        [HttpStatus.OK]: {
                            description: deleteMessages[name],
                            schema: getSchemaPath ? { $ref: getSchemaPath(MessageResponseDto) } : undefined,
                            type: MessageResponseDto,
                            ...(name === CrudActionsEnum.DELETE_MANY ? {
                                examples: {
                                    'Success': {
                                        summary: 'Items deleted successfully',
                                        description: 'Response when items were deleted',
                                        value: { message: 'Successfully deleted' },
                                    },
                                    'No Items': {
                                        summary: 'No items to delete',
                                        description: 'Response when no items matched the delete criteria',
                                        value: { message: 'No items to delete' },
                                    },
                                },
                            } : {
                                example: { message: 'Successfully deleted' },
                            }),
                        },
                    };
                    break;

                case CrudActionsEnum.DELETE_FROM_TRASH:
                case CrudActionsEnum.DELETE_FROM_TRASH_MANY:
                case CrudActionsEnum.RESTORE:
                case CrudActionsEnum.RESTORE_MANY:
                    // These return { success: true, message: string }
                    // Use reusable SuccessMessageResponseDto schema reference
                    const successMessages = {
                        [CrudActionsEnum.DELETE_FROM_TRASH]: 'Successfully permanently deleted the item from trash',
                        [CrudActionsEnum.DELETE_FROM_TRASH_MANY]: 'Successfully permanently deleted multiple items from trash',
                        [CrudActionsEnum.RESTORE]: 'Successfully restored the item',
                        [CrudActionsEnum.RESTORE_MANY]: 'Successfully restored multiple items',
                    };
                    const successMessageValues = {
                        [CrudActionsEnum.DELETE_FROM_TRASH]: 'Successfully deleted',
                        [CrudActionsEnum.DELETE_FROM_TRASH_MANY]: 'Successfully deleted',
                        [CrudActionsEnum.RESTORE]: 'Successfully restored',
                        [CrudActionsEnum.RESTORE_MANY]: 'Successfully restored',
                    };
                    successResponse = {
                        [HttpStatus.OK]: {
                            description: successMessages[name],
                            schema: getSchemaPath ? { $ref: getSchemaPath(SuccessMessageResponseDto) } : undefined,
                            type: SuccessMessageResponseDto,
                            example: {
                                success: true,
                                message: successMessageValues[name],
                            },
                        },
                    };
                    break;

                case CrudActionsEnum.REORDER:
                    // reorder returns void (undefined)
                    successResponse = {
                        [HttpStatus.OK]: {
                            description: 'Successfully reordered items',
                            schema: {
                                type: 'object',
                                description: 'Empty response body',
                                properties: {},
                            },
                        },
                    };
                    break;

                default:
                    successResponse = {
                        [HttpStatus.OK]: {
                            description: 'Success response',
                        },
                    };
            }

            // Merge success response with error responses
            return {
                ...successResponse,
                ...errorResponses,
            };
        } else {
            return {};
        }
    }

    static createPathParamsMeta(options: any): any[] {
        return DECORATORS
            ? objKeys(options).map((param: any) => ({
                name: param,
                required: true,
                in: 'path',
                type: options[param].type === 'number' ? Number : String,
                enum: options[param].enum ? Object.values(options[param].enum) : undefined,
            }))
            : /* istanbul ignore next */[];
    }

    /**
     * Gets the tag to use for all routes
     * If controller already has tags, use those. Otherwise set and return default tag.
     */
    static getControllerTagForRoutes(controller: any, defaultName: string): string[] {
        // Check if controller already has tags (from @ApiTags decorator)
        let controllerTags = Swagger.getControllerTags(controller);

        if (!controllerTags || controllerTags.length === 0) {
            // No controller tags, create default tag and set it on controller
            controllerTags = Swagger.getOperationTags(defaultName);
            Swagger.setControllerTags(controllerTags, controller);
        }

        return controllerTags;
    }

    /**
     * Sets up Swagger operation metadata (summary, description, operationId, tags)
     */
    static setOperationForRoute(
        method: any,
        name: CrudActionsEnum,
        entityName: string,
        controllerName: string,
        controller: any,
        defaultName: string
    ): void {
        const operationId = `${name}${controllerName}${entityName}`;
        const current = Swagger.getOperation(method);

        // Get tags to use - if controller has tags, use those, otherwise use default
        const tagsToUse = Swagger.getControllerTagForRoutes(controller, defaultName);

        // Use existing tags if method already has them, otherwise use controller tags
        const tags = current.tags && current.tags.length > 0 ? current.tags : tagsToUse;

        Swagger.setOperation({
            ...current,
            summary: current.summary || Swagger.operationsMap(entityName)[name],
            description: current.description || current.summary || Swagger.operationsMap(entityName)[name],
            operationId: current.operationId || operationId,
            tags,
        }, method);
    }

    /**
     * Sets up Swagger path parameters documentation
     */
    static setPathParamsForRoute(method: any, name: CrudActionsEnum): void {
        const metadata = Swagger.getParams(method);
        const withPrimary: CrudActionsEnum[] = [
            CrudActionsEnum.FIND_ONE,
            CrudActionsEnum.UPDATE,
            CrudActionsEnum.DELETE,
            CrudActionsEnum.DELETE_FROM_TRASH,
            CrudActionsEnum.RESTORE,
        ];

        const params: Record<string, any> = {};

        // Add primary ID parameter for routes that need it
        if (withPrimary.includes(name)) {
            params.id = {
                type: 'uuid',
                primary: true,
            };
        }

        const pathParamsMeta = Swagger.createPathParamsMeta(params);
        const existingParamNames = new Set(metadata.map((param: any) => param.name));
        const filteredPathParamsMeta = pathParamsMeta.filter((param: any) => !existingParamNames.has(param.name));

        Swagger.setParams([...metadata, ...filteredPathParamsMeta], method);
    }

    /**
     * Sets up Swagger response documentation
     */
    static setResponseForRoute(method: any, name: CrudActionsEnum, entityType: any, controller?: any): void {
        // Ensure entity is registered with Swagger if it exists
        if (entityType && controller) {
            Swagger.setExtraModels({
                entity: entityType,
                get: controller
            });
        }

        const metadata = Swagger.getResponseOk(method);
        const metadataToAdd = Swagger.createResponseMeta(name, entityType);

        const mergedMeta: Record<string, any> = {
            ...metadataToAdd,
            ...metadata,
        };

        Swagger.setResponseOk(mergedMeta, method);
    }
}

// Export ApiProperty function
export { ApiProperty };
