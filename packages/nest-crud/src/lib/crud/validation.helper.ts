import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsNumber, IsObject, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { isNil, uniq } from 'lodash';
import { getMetadataArgsStorage } from 'typeorm';

import { CrudOptions, CrudValidationGroupsEnum } from '../interface/crud';
import { resolveMaxPerPage } from '../helper/pagination-limit';
import { isFalse } from '../utils';
import { WhereOptions } from '../types';
import { getHiddenFields } from '../decorator/crud-hidden.decorator';

/**
 * Helper function to generate documentation links
 * @param anchor - Optional anchor/hash for specific sections
 * @returns Markdown formatted link to documentation
 */
const docsLink = (anchor?: string): string => {
    const baseUrl = 'https://ack-solutions.github.io/nest-crud/querying';
    const url = anchor ? `${baseUrl}#${anchor}` : baseUrl;
    return `[Documentation](${url})`;
};

/**
 * Real, non-system, non-hidden column / relation names for an entity, used to build
 * Swagger examples that match the actual entity instead of generic placeholders.
 * Reads TypeORM's metadata-args storage (populated at decorator time, before the
 * DataSource initialises). Falls back to empty arrays on any error.
 */
function entityFields(entity: any): { columns: string[]; relations: string[]; toMany: string[] } {
    try {
        const storage = getMetadataArgsStorage();
        const inChain = (target: any) =>
            typeof target === 'function' && (target === entity || entity.prototype instanceof target);
        const system = new Set(['id', 'createdAt', 'updatedAt', 'deletedAt', 'version']);
        const hidden = getHiddenFields(entity);
        const keep = (name: string) => !system.has(name) && !hidden.has(name);

        const columns = uniq(storage.columns.filter((c) => inChain(c.target)).map((c) => c.propertyName)).filter(keep);
        const rels = storage.relations.filter((r) => inChain(r.target) && !hidden.has(r.propertyName));
        const relations = uniq(rels.map((r) => r.propertyName));
        const toMany = uniq(
            rels.filter((r) => r.relationType === 'one-to-many' || r.relationType === 'many-to-many').map((r) => r.propertyName),
        );
        return { columns, relations, toMany };
    } catch {
        return { columns: [], relations: [], toMany: [] };
    }
}


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
        description: `Return only soft-deleted records. When true, only records that have been soft-deleted will be returned. Requires softDelete to be enabled on the entity. ${docsLink('soft-delete')}`,
        example: true,
        default: false,
        type: Boolean
    })
    @IsOptional()
    @Transform(({ value }) => (value === undefined ? undefined : value === true || value === 'true' || value === '1'))
    @IsBoolean()
    onlyDeleted?: boolean;

    @ApiPropertyOptional({
        description: `Include soft-deleted records in the results. When true, both active and soft-deleted records will be returned. Requires softDelete to be enabled on the entity. ${docsLink('soft-delete')}`,
        example: false,
        default: false,
        type: Boolean
    })
    @IsOptional()
    @Transform(({ value }) => (value === undefined ? undefined : value === true || value === 'true' || value === '1'))
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
            // Resolve from @Crud / CrudConfigService, honouring both `maxPerPage`
            // and the legacy `maxPageSize`, so the Swagger @Max reflects the real cap.
            const maxPerPage = resolveMaxPerPage(options);

            // Build Swagger examples from the entity's real columns / relations so the
            // "Try it out" values match the entity. All examples are JSON STRINGS, so
            // Swagger UI renders a plain text box (no "must be valid JSON" rejection).
            const fields = entityFields(options.entity);
            const cols = fields.columns.length ? fields.columns : ['id', 'name', 'email'];
            const rels = fields.relations.length ? fields.relations : ['profile', 'posts'];
            const aggRel = fields.toMany[0] ?? fields.relations[0] ?? 'posts';
            const orderCol = cols[0];
            const aggAlias = `${aggRel}Count`;
            const ex = {
                whereEquals: JSON.stringify({ [cols[0]]: 'value' }),
                whereIn: JSON.stringify({ [cols[0]]: { $in: ['a', 'b'] } }),
                whereSearch: JSON.stringify({ [cols[0]]: { $iLike: '%a%' } }),
                whereExists: JSON.stringify({ [aggRel]: { $exists: true } }),
                relationsArray: JSON.stringify(rels.slice(0, 2)),
                relationsObject: JSON.stringify([{ [aggRel]: { select: [cols[0]], joinType: 'inner' } }]),
                relationsNested: '["posts.comments","profile.addresses"]',
                orderSingle: JSON.stringify({ [orderCol]: 'DESC' }),
                orderMultiple: JSON.stringify({ [orderCol]: 'DESC', createdAt: 'ASC' }),
                select: JSON.stringify(cols.slice(0, 3)),
                aggOne: JSON.stringify([{ fn: 'count', field: `${aggRel}.id`, as: aggAlias }]),
                aggMany: JSON.stringify([
                    { fn: 'count', field: `${aggRel}.id`, as: aggAlias },
                    { fn: 'sum', field: `${aggRel}.likes`, as: `${aggRel}Likes` },
                ]),
                having: JSON.stringify({ [aggAlias]: { $gt: 1 } }),
            };

            class FindManyImpl extends ManyConditionDto {

                @ApiPropertyOptional({
                    type: String,
                    description: `Filter as a **JSON string**. Shorthand \`{"field":value}\` = equals; full form \`{"field":{"$op":value}}\`. Operators: $eq $ne $ieq $gt $gte $lt $lte $in $notIn $like $iLike $startsWith $endsWith $between $isNull $isNotNull $isTrue $isFalse $exists $notExists, grouped with $and / $or. ${docsLink('query-operators')}`,
                    examples: {
                        equals: { summary: 'Equals', value: ex.whereEquals },
                        inList: { summary: 'In a list', value: ex.whereIn },
                        search: { summary: 'Case-insensitive contains', value: ex.whereSearch },
                        relationExists: { summary: 'Relation has rows', value: ex.whereExists },
                    },
                })
                @IsOptional()
                where?: WhereOptions | string;

                @ApiPropertyOptional({
                    type: String,
                    description: `Relations to join, as a **JSON string**. An array of names, dot-notation for nested relations, or an object with per-relation \`select\` / \`where\` / \`joinType\` (left|inner). ${docsLink('relations')}`,
                    examples: {
                        array: { summary: 'Array of relation names', value: ex.relationsArray },
                        nested: { summary: 'Nested (dot notation)', value: ex.relationsNested },
                        object: { summary: 'Object: select + inner join', value: ex.relationsObject },
                    },
                })
                @IsOptional()
                relations?: string[] | Record<string, boolean> | string;

                @ApiPropertyOptional({
                    type: String,
                    description: `Sort as a **JSON string**: \`column\` → \`ASC\` | \`DESC\`. Accepts aggregate aliases and dot-notation. ${docsLink('order')}`,
                    examples: {
                        single: { summary: 'Single field', value: ex.orderSingle },
                        multiple: { summary: 'Multiple fields', value: ex.orderMultiple },
                    },
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
                    description: `Number of records to take (max \`maxPerPage\` from server config). ${docsLink('pagination')}`,
                    example: 10,
                    minimum: 1,
                    maximum: maxPerPage,
                    default: maxPerPage,
                    type: Number
                })
                @IsOptional()
                @Type(() => Number)
                @IsNumber()
                @Min(1)
                @Max(maxPerPage)
                take?: number;

                @ApiPropertyOptional({
                    type: String,
                    description: `Columns to return, as a **JSON string** array. The primary key is always included; hidden fields are dropped. ${docsLink('select')}`,
                    examples: {
                        columns: { summary: 'Pick columns', value: ex.select },
                    },
                })
                @IsOptional()
                select?: string[] | string;

                @ApiPropertyOptional({
                    type: String,
                    description: `Per-row aggregates over a relation (count/sum/avg/min/max), as a **JSON string** of \`{ fn, field, as }\` — \`field\` is relation-qualified (e.g. \`posts.id\`); \`as\` is the alias used by \`having\`/\`order\`. ${docsLink('aggregates')}`,
                    examples: {
                        count: { summary: 'Count related rows', value: ex.aggOne },
                        multiple: { summary: 'count + sum', value: ex.aggMany },
                    },
                })
                @IsOptional()
                aggregates?: any[] | string;

                @ApiPropertyOptional({
                    type: String,
                    description: `Filter on aggregate aliases, as a **JSON string** — same operator syntax as \`where\`. ${docsLink('aggregates')}`,
                    examples: {
                        gt: { summary: 'Alias greater-than', value: ex.having },
                    },
                })
                @IsOptional()
                having?: Record<string, any> | string;

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
            const countCols = entityFields(options.entity).columns;
            const groupCol = countCols[0] ?? 'status';
            const filterEx = JSON.stringify({ where: { [groupCol]: 'value' } });

            class CountsImpl {
                @ApiPropertyOptional({
                    type: String,
                    description: `Filter as a **JSON string** — the same shape as a findMany query (\`where\`, \`relations\`, …). ${docsLink('query-operators')}`,
                    examples: {
                        where: { summary: 'Filter by where', value: filterEx },
                    },
                })
                @IsOptional()
                filter?: any;

                @ApiPropertyOptional({
                    type: String,
                    description: `Column to group counts by. Repeat the parameter for multiple columns. ${docsLink('counts')}`,
                    example: groupCol,
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
            const oneFields = entityFields(options.entity);
            const relEx = JSON.stringify(oneFields.relations.length ? oneFields.relations.slice(0, 2) : ['profile', 'posts']);

            class FindOneImpl {

                @ApiPropertyOptional({
                    type: String,
                    description: `Relations to join, as a **JSON string** (array of names, dot-notation for nested, or an object with per-relation \`select\` / \`joinType\`). ${docsLink('relations')}`,
                    examples: {
                        array: { summary: 'Array of relation names', value: relEx },
                        nested: { summary: 'Nested (dot notation)', value: '["posts.comments","profile.addresses"]' },
                    },
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
