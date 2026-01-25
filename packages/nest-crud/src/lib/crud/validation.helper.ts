import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsNumber, IsObject, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { isNil } from 'lodash';

import { CrudOptions, CrudValidationGroupsEnum } from '../interface/crud';
import { isFalse } from '../utils';
import { WhereOptions } from '../types';

/**
 * Helper function to generate documentation links
 * @param anchor - Optional anchor/hash for specific sections
 * @returns Markdown formatted link to documentation
 */
const docsLink = (anchor?: string): string => {
    const baseUrl = 'https://ack-solutions.github.io/packages/nest-crud';
    const url = anchor ? `${baseUrl}#${anchor}` : baseUrl;
    return `[Documentation](${url})`;
};


class FindManyDto {

}

class FindOneDto {

}

class DeleteManyDto {

}

class ReorderDto {

}

class BulkDto<T> {

    bulk: T[];

}

class RestoreManyDto {

}

class CountsDto {

}

class ManyConditionDto {
    @ApiPropertyOptional({
        description: `Conditions to filter the query. Supports complex filtering with operators like $gt, $lt, $in, $like, $between, $or, $and, etc. Can be provided as a JSON string or object. ${docsLink('query-operators')}`,
        examples: {
            simpleFilter: {
                summary: 'Simple filter',
                description: 'Filter by single field with comparison operators',
                value: {
                    age: { $gt: 18, $lt: 65 },
                    status: 'active'
                }
            },
            complexFilter: {
                summary: 'Complex filter with $or',
                description: 'Filter using logical OR operator',
                value: {
                    $or: [
                        {
                            firstName: { $like: '%John%' },
                            lastName: { $like: '%Doe%' },
                        },
                        {
                            lastName: { $like: '%Doe%' },
                            firstName: { $like: '%John%' },
                        },
                    ],
                    age: {
                        $gt: 18,
                        $lt: 65,
                    },
                    status: { $in: ['active', 'inactive'] },
                    joinedDate: { $between: ['2020-01-01', '2021-01-01'] },
                }
            },
            jsonString: {
                summary: 'JSON string format',
                description: 'Filter as JSON string',
                value: '{"age":{"$gt":18,"$lt":65},"status":"active"}'
            },
            nestedRelations: {
                summary: 'Nested relation filter',
                description: 'Filter using dot notation for nested relations',
                value: {
                    'profile.age': { $gt: 18 },
                    'profile.status': { $in: ['active', 'pending'] }
                }
            }
        },
        oneOf: [
            {
                type: 'string',
                description: 'JSON string representation of the filter conditions',
                example: '{"age":{"$gt":18},"status":"active"}'
            },
            {
                type: 'object',
                description: 'Object representation of filter conditions',
                additionalProperties: true
            }
        ]
    })
    @IsOptional()
    where?: WhereOptions | string; // Support both object and JSON string

    @ApiPropertyOptional({
        description: `Return only soft-deleted records. When true, only records that have been soft-deleted will be returned. Requires softDelete to be enabled on the entity. ${docsLink('soft-delete')}`,
        example: true,
        default: false,
        type: Boolean
    })
    @IsOptional()
    @IsBoolean()
    onlyDeleted?: boolean;

    @ApiPropertyOptional({
        description: `Include soft-deleted records in the results. When true, both active and soft-deleted records will be returned. Requires softDelete to be enabled on the entity. ${docsLink('soft-delete')}`,
        example: false,
        default: false,
        type: Boolean
    })
    @IsOptional()
    @IsBoolean()
    withDeleted?: boolean;
}



export class Validation {

    static getValidationPipe(options: ValidationPipeOptions = {}, group?: CrudValidationGroupsEnum): ValidationPipe {
        return new ValidationPipe({
            ...options,
            groups: group ? [group] : undefined,
        });
    }

    static createFindManyDto(options: Partial<CrudOptions>): any {
        /* istanbul ignore else */

        if (!isFalse(options.validation)) {
            class FindManyImpl extends ManyConditionDto {

                @ApiPropertyOptional({
                    description: `Relations to include in the query. Can be provided as an array of relation names, an object with relation configurations, or a JSON string. Supports nested relations using dot notation. ${docsLink('relations')}`,
                    examples: {
                        simpleArray: {
                            summary: 'Simple array of relation names',
                            description: 'Include multiple relations as an array',
                            value: ['profile', 'address', 'orders']
                        },
                        objectFormat: {
                            summary: 'Object format with configuration',
                            description: 'Include relations with additional configuration',
                            value: {
                                profile: true,
                                address: { select: ['id', 'street', 'city'] },
                                orders: { where: { status: 'active' } }
                            }
                        },
                        jsonString: {
                            summary: 'JSON string format',
                            description: 'Relations as JSON string',
                            value: '["profile","address","orders"]'
                        },
                        nestedRelations: {
                            summary: 'Nested relations',
                            description: 'Include nested relations using dot notation',
                            value: ['profile', 'profile.address', 'orders', 'orders.items']
                        }
                    },
                    oneOf: [
                        {
                            type: 'string',
                            description: 'JSON string representation of relations',
                            example: '["profile","address"]'
                        },
                        {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Array of relation names',
                            example: ['profile', 'address']
                        },
                        {
                            type: 'object',
                            description: 'Object with relation configurations',
                            additionalProperties: true,
                            example: { profile: true, address: { select: ['id', 'street'] } }
                        }
                    ]
                })
                @IsOptional()
                relations?: string[] | Record<string, boolean> | string;

                @ApiPropertyOptional({
                    description: `Order of the results. Specifies the sorting order for the query results. Can be provided as an object with field:direction pairs or as a JSON string. Supports dot notation for nested properties. ${docsLink('order')}`,
                    examples: {
                        simpleOrder: {
                            summary: 'Simple ordering',
                            description: 'Order by single field',
                            value: { createdAt: 'DESC' }
                        },
                        multipleFields: {
                            summary: 'Multiple fields',
                            description: 'Order by multiple fields',
                            value: {
                                age: 'ASC',
                                name: 'DESC',
                                createdAt: 'ASC'
                            }
                        },
                        nestedProperties: {
                            summary: 'Nested properties',
                            description: 'Order using dot notation for nested properties',
                            value: {
                                'profile.age': 'ASC',
                                'profile.name': 'DESC',
                                'profile.joinedDate': 'ASC',
                                createdAt: 'DESC'
                            }
                        },
                        jsonString: {
                            summary: 'JSON string format',
                            description: 'Order as JSON string',
                            value: '{"createdAt":"DESC","age":"ASC"}'
                        }
                    },
                    oneOf: [
                        {
                            type: 'string',
                            description: 'JSON string representation of order',
                            example: '{"createdAt":"DESC","age":"ASC"}'
                        },
                        {
                            type: 'object',
                            description: 'Object with field: direction pairs',
                            additionalProperties: {
                                type: 'string',
                                enum: ['ASC', 'DESC']
                            },
                            example: { createdAt: 'DESC', age: 'ASC' }
                        }
                    ]
                })
                @IsOptional()
                order?: Record<string, 'ASC' | 'DESC'> | string;

                @ApiPropertyOptional({
                    description: `Number of records to skip (pagination offset). Used for pagination to skip a certain number of records before starting to return results. ${docsLink('pagination')}`,
                    example: 0,
                    minimum: 0,
                    default: 0,
                    type: Number
                })
                @IsOptional()
                @Type(() => Number)
                @IsNumber()
                skip?: number;

                @ApiPropertyOptional({
                    description: `Number of records to take (pagination limit). Maximum number of records to return in the result set. ${docsLink('pagination')}`,
                    example: 10,
                    minimum: 1,
                    default: 10,
                    type: Number
                })
                @IsOptional()
                @Type(() => Number)
                @IsNumber()
                take?: number;

                @ApiPropertyOptional({
                    description: `Fields to select from the entity. Specifies which fields should be included in the response. Can be provided as an array of field names or as a JSON string. Supports dot notation for nested properties. ${docsLink('select')}`,
                    examples: {
                        simpleFields: {
                            summary: 'Simple field selection',
                            description: 'Select specific fields',
                            value: ['id', 'name', 'email', 'createdAt']
                        },
                        nestedFields: {
                            summary: 'Nested fields',
                            description: 'Select nested fields using dot notation',
                            value: ['id', 'name', 'email', 'profile.age', 'profile.name', 'profile.joinedDate']
                        },
                        jsonString: {
                            summary: 'JSON string format',
                            description: 'Select fields as JSON string',
                            value: '["id","name","email"]'
                        }
                    },
                    oneOf: [
                        {
                            type: 'string',
                            description: 'JSON string representation of field names',
                            example: '["id","name","email"]'
                        },
                        {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Array of field names to select',
                            example: ['id', 'name', 'email']
                        }
                    ]
                })
                @IsOptional()
                select?: string[] | string;

            }
            Object.defineProperty(FindManyImpl, 'name', {
                writable: false,
                value: `FindMany${options.entity.name}Dto`,
            });
            return FindManyImpl;
        }

        return FindManyDto;
    }

    static createCountsDto(options: Partial<CrudOptions>): any {
        /* istanbul ignore else */
        if (!isFalse(options.validation)) {
            class CountsImpl {
                @ApiPropertyOptional({
                    description: `Filter conditions to apply to the count query. Supports all the same filtering options as findMany, including where conditions, soft-delete filters, etc. ${docsLink('query-operators')}`,
                    type: ManyConditionDto,
                })
                @IsOptional()
                @ValidateNested()
                @Type(() => ManyConditionDto)
                filter?: ManyConditionDto;

                @ApiPropertyOptional({
                    description: `Group by key(s) for counting. When provided, returns counts grouped by the specified field(s). Can be a single field name or an array of field names for multiple grouping. ${docsLink('counts')}`,
                    examples: {
                        singleField: {
                            summary: 'Single field grouping',
                            description: 'Group counts by a single field',
                            value: 'status'
                        },
                        multipleFields: {
                            summary: 'Multiple fields grouping',
                            description: 'Group counts by multiple fields',
                            value: ['status', 'category']
                        }
                    },
                    oneOf: [
                        {
                            type: 'string',
                            description: 'Single field name to group by',
                            example: 'status'
                        },
                        {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Array of field names to group by',
                            example: ['status', 'category']
                        }
                    ]
                })
                @IsOptional()
                groupByKey?: string | string[];

            }
            Object.defineProperty(CountsImpl, 'name', {
                writable: false,
                value: `Counts${options.entity.name}Dto`,
            });
            return CountsImpl;
        }
        return CountsDto;
    }

    static createFindOneDto(options: Partial<CrudOptions>): any {
        /* istanbul ignore else */

        if (!isFalse(options.validation)) {
            class FindOneImpl {

                @ApiPropertyOptional({
                    description: `Relations to include in the query. Can be provided as an array of relation names, an object with relation configurations, or a JSON string. Supports nested relations using dot notation. ${docsLink('relations')}`,
                    examples: {
                        simpleArray: {
                            summary: 'Simple array of relation names',
                            description: 'Include multiple relations as an array',
                            value: ['profile', 'address', 'orders']
                        },
                        objectFormat: {
                            summary: 'Object format with configuration',
                            description: 'Include relations with additional configuration',
                            value: {
                                profile: true,
                                address: { select: ['id', 'street', 'city'] },
                                orders: { where: { status: 'active' } }
                            }
                        },
                        jsonString: {
                            summary: 'JSON string format',
                            description: 'Relations as JSON string',
                            value: '["profile","address"]'
                        },
                        nestedRelations: {
                            summary: 'Nested relations',
                            description: 'Include nested relations using dot notation',
                            value: ['profile', 'profile.address', 'orders', 'orders.items']
                        }
                    },
                    oneOf: [
                        {
                            type: 'string',
                            description: 'JSON string representation of relations',
                            example: '["profile","address"]'
                        },
                        {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Array of relation names',
                            example: ['profile', 'address']
                        },
                        {
                            type: 'object',
                            description: 'Object with relation configurations',
                            additionalProperties: true,
                            example: { profile: true, address: { select: ['id', 'street'] } }
                        }
                    ]
                })
                @IsOptional()
                relations?: any[] | Record<string, boolean> | string;

            }
            Object.defineProperty(FindOneImpl, 'name', {
                writable: false,
                value: `FindOne${options.entity.name}Dto`,
            });
            return FindOneImpl;
        }

        return FindOneDto;
    }

    /* istanbul ignore else */
    static createBulkDto<T = any>(options: Partial<CrudOptions>): any {
        /* istanbul ignore else */
        if (!isFalse(options.validation)) {
            const hasDto = !isNil(options.dto?.create);
            const groups = !hasDto ? [CrudValidationGroupsEnum.CREATE] : undefined;
            const always = hasDto ? true : undefined;
            const Model = hasDto ? options.dto?.create : options.entity.type;


            class BulkDtoImpl {

                @ApiProperty({
                    description: `Array of ${options.entity.name} entities to create. Each item in the array will be validated according to the entity's validation rules. Minimum one item is required. ${docsLink('bulk-operations')}`,
                    type: Model,
                    isArray: true,
                    examples: {
                        simpleBulk: {
                            summary: 'Simple bulk create',
                            description: 'Create multiple entities with basic fields',
                            value: {
                                bulk: [
                                    {
                                        title: 'Item 1',
                                        description: 'Description for item 1',
                                        status: 'draft'
                                    },
                                    {
                                        title: 'Item 2',
                                        description: 'Description for item 2',
                                        status: 'published'
                                    },
                                    {
                                        title: 'Item 3',
                                        status: 'draft'
                                    }
                                ]
                            }
                        },
                        bulkWithRelations: {
                            summary: 'Bulk create with relations',
                            description: 'Create multiple entities with relation IDs',
                            value: {
                                bulk: [
                                    {
                                        title: 'Item 1',
                                        description: 'First item',
                                        status: 'draft',
                                        projectId: '123e4567-e89b-12d3-a456-426614174000'
                                    },
                                    {
                                        title: 'Item 2',
                                        description: 'Second item',
                                        status: 'published',
                                        projectId: '123e4567-e89b-12d3-a456-426614174001'
                                    }
                                ]
                            }
                        },
                        bulkWithMetadata: {
                            summary: 'Bulk create with metadata',
                            description: 'Create multiple entities with complex metadata',
                            value: {
                                bulk: [
                                    {
                                        title: 'Item 1',
                                        description: 'Item with metadata',
                                        status: 'draft',
                                        metadata: {
                                            tags: ['tag1', 'tag2'],
                                            priority: 'high',
                                            category: 'development'
                                        }
                                    },
                                    {
                                        title: 'Item 2',
                                        description: 'Another item',
                                        status: 'published',
                                        metadata: {
                                            tags: ['tag3'],
                                            priority: 'low'
                                        }
                                    }
                                ]
                            }
                        },
                        minimalBulk: {
                            summary: 'Minimal bulk create',
                            description: 'Create multiple entities with only required fields',
                            value: {
                                bulk: [
                                    { title: 'Item 1' },
                                    { title: 'Item 2' },
                                    { title: 'Item 3' }
                                ]
                            }
                        }
                    }
                })
                @IsArray({
                    groups,
                    always,
                })
                @ArrayNotEmpty({
                    groups,
                    always,
                })
                @ValidateNested({
                    each: true,
                    groups,
                    always,
                })
                @Type(() => Model)
                bulk: T[];

            }

            Object.defineProperty(BulkDtoImpl, 'name', {
                writable: false,
                value: `CreateMany${options.entity.name}Dto`,
            });

            return BulkDtoImpl;
        }
        return BulkDto;
    }


    static updateBulkDto<T = any>(options: Partial<CrudOptions>): any {
        /* istanbul ignore else */
        if (!isFalse(options.validation)) {
            const hasDto = !isNil(options.dto?.update);
            const groups = !hasDto ? [CrudValidationGroupsEnum.UPDATE] : undefined;
            const always = hasDto ? true : undefined;
            const Model = hasDto ? options.dto?.update : options.entity.type;

            class BulkDtoImpl {

                @ApiProperty({
                    description: `Array of ${options.entity.name} entities to update. Each item in the array must include an id field to identify the entity to update. Only provided fields will be updated (partial update). Minimum one item is required. ${docsLink('bulk-operations')}`,
                    type: Model,
                    isArray: true,
                    examples: {
                        simpleBulkUpdate: {
                            summary: 'Simple bulk update',
                            description: 'Update multiple entities with basic fields',
                            value: {
                                bulk: [
                                    {
                                        id: '123e4567-e89b-12d3-a456-426614174000',
                                        title: 'Updated Item 1',
                                        status: 'published'
                                    },
                                    {
                                        id: '123e4567-e89b-12d3-a456-426614174001',
                                        title: 'Updated Item 2',
                                        description: 'Updated description'
                                    }
                                ]
                            }
                        },
                        partialUpdate: {
                            summary: 'Partial bulk update',
                            description: 'Update only specific fields for multiple entities',
                            value: {
                                bulk: [
                                    {
                                        id: '123e4567-e89b-12d3-a456-426614174000',
                                        status: 'archived'
                                    },
                                    {
                                        id: '123e4567-e89b-12d3-a456-426614174001',
                                        status: 'published'
                                    },
                                    {
                                        id: '123e4567-e89b-12d3-a456-426614174002',
                                        title: 'New Title'
                                    }
                                ]
                            }
                        },
                        bulkUpdateWithRelations: {
                            summary: 'Bulk update with relations',
                            description: 'Update multiple entities including relation changes',
                            value: {
                                bulk: [
                                    {
                                        id: '123e4567-e89b-12d3-a456-426614174000',
                                        title: 'Updated Item 1',
                                        projectId: '123e4567-e89b-12d3-a456-426614174010',
                                        status: 'published'
                                    },
                                    {
                                        id: '123e4567-e89b-12d3-a456-426614174001',
                                        title: 'Updated Item 2',
                                        projectId: '123e4567-e89b-12d3-a456-426614174011',
                                        status: 'draft'
                                    }
                                ]
                            }
                        },
                        bulkUpdateWithMetadata: {
                            summary: 'Bulk update with metadata',
                            description: 'Update multiple entities with complex metadata',
                            value: {
                                bulk: [
                                    {
                                        id: '123e4567-e89b-12d3-a456-426614174000',
                                        metadata: {
                                            tags: ['updated', 'tag1'],
                                            priority: 'medium',
                                            lastModified: '2024-01-01T00:00:00Z'
                                        }
                                    },
                                    {
                                        id: '123e4567-e89b-12d3-a456-426614174001',
                                        title: 'Updated Title',
                                        metadata: {
                                            tags: ['tag2'],
                                            category: 'production'
                                        }
                                    }
                                ]
                            }
                        },
                        statusBulkUpdate: {
                            summary: 'Status bulk update',
                            description: 'Update status for multiple entities',
                            value: {
                                bulk: [
                                    {
                                        id: '123e4567-e89b-12d3-a456-426614174000',
                                        status: 'published'
                                    },
                                    {
                                        id: '123e4567-e89b-12d3-a456-426614174001',
                                        status: 'published'
                                    },
                                    {
                                        id: '123e4567-e89b-12d3-a456-426614174002',
                                        status: 'archived'
                                    }
                                ]
                            }
                        }
                    }
                })
                @IsArray({
                    groups,
                    always,
                })
                @ArrayNotEmpty({
                    groups,
                    always,
                })
                @ValidateNested({
                    each: true,
                    groups,
                    always,
                })
                @Type(() => Model)
                bulk: T[];

            }

            Object.defineProperty(BulkDtoImpl, 'name', {
                writable: false,
                value: `UpdateMany${options.entity.name}Dto`,
            });

            return BulkDtoImpl;
        }
        return BulkDto;
    }


    static createDeleteManyDto(options: Partial<CrudOptions>): any {
        /* istanbul ignore else */
        if (!isFalse(options.validation)) {
            class DeleteManyImpl {

                @ApiPropertyOptional({
                    description: 'Array of entity IDs to delete. Each ID should be a valid UUID. Either ids or where condition must be provided.',
                    format: 'uuid',
                    isArray: true,
                    example: ['123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001'],
                    type: [String]
                })
                @IsOptional()
                @IsArray()
                ids?: string[];

                // @ApiPropertyOptional({
                //     description: `Where conditions to filter records for deletion. Supports the same filtering syntax as findMany. Either ids or where condition must be provided. When both are provided, records matching either condition will be deleted. ${docsLink('query-operators')}`,
                //     examples: {
                //         simpleFilter: {
                //             summary: 'Simple filter',
                //             description: 'Delete records matching simple conditions',
                //             value: { status: 'inactive', archived: true }
                //         },
                //         complexFilter: {
                //             summary: 'Complex filter',
                //             description: 'Delete records using complex conditions',
                //             value: {
                //                 $or: [
                //                     { status: 'deleted' },
                //                     { archived: true, createdAt: { $lt: '2020-01-01' } }
                //                 ]
                //             }
                //         },
                //         jsonString: {
                //             summary: 'JSON string format',
                //             description: 'Where condition as JSON string',
                //             value: '{"status":"inactive","archived":true}'
                //         }
                //     },
                //     oneOf: [
                //         {
                //             type: 'string',
                //             description: 'JSON string representation of where conditions',
                //             example: '{"status":"inactive"}'
                //         },
                //         {
                //             type: 'object',
                //             description: 'Object representation of where conditions',
                //             additionalProperties: true
                //         }
                //     ]
                // })
                // @IsOptional()
                // where?: any;

            }
            Object.defineProperty(DeleteManyImpl, 'name', {
                writable: false,
                value: `DeleteMany${options.entity.name}Dto`,
            });
            return DeleteManyImpl;
        }
        return DeleteManyDto;
    }

    static createTrashDeleteManyDto(options: Partial<CrudOptions>): any {
        /* istanbul ignore else */
        if (!isFalse(options.validation)) {
            return this.createDeleteManyDto(options);
        }
        return DeleteManyDto;
    }


    static createReorderDto(options: Partial<CrudOptions>): any {
        /* istanbul ignore else */
        if (!isFalse(options.validation)) {
            class ReorderImpl {

                @ApiProperty({
                    description: `Array of entity IDs in the desired order. The order of IDs in this array determines the new order of the entities. All IDs must be valid UUIDs. ${docsLink('reorder')}`,
                    type: String,
                    isArray: true,
                    example: [
                        '123e4567-e89b-12d3-a456-426614174000',
                        '123e4567-e89b-12d3-a456-426614174001',
                        '123e4567-e89b-12d3-a456-426614174002'
                    ],
                    format: 'uuid'
                })
                @IsArray()
                @ArrayNotEmpty()
                @IsString({ each: true })
                ids: string[];

            }
            Object.defineProperty(ReorderImpl, 'name', {
                writable: false,
                value: `Reorder${options.entity.name}Dto`,
            });
            return ReorderImpl;
        }
        return ReorderDto;
    }

    static createRestoreManyDto(options: Partial<CrudOptions>): any {
        /* istanbul ignore else */
        if (!isFalse(options.validation)) {
            class RestoreManyImpl {

                @ApiProperty({
                    description: `Array of soft-deleted entity IDs to restore. Each ID should be a valid UUID. Only soft-deleted records can be restored. Requires softDelete to be enabled on the entity. ${docsLink('soft-delete')}`,
                    type: String,
                    isArray: true,
                    example: [
                        '123e4567-e89b-12d3-a456-426614174000',
                        '123e4567-e89b-12d3-a456-426614174001'
                    ],
                    format: 'uuid'
                })
                @IsArray()
                @ArrayNotEmpty()
                @IsString({ each: true })
                ids: string[];

            }
            Object.defineProperty(RestoreManyImpl, 'name', {
                writable: false,
                value: `RestoreMany${options.entity.name}Dto`,
            });
            return RestoreManyImpl;
        }
        return RestoreManyDto;
    }

}
