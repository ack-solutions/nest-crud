import { DataSource, EntityMetadata, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { OrderDirectionEnum, RelationObject, RelationObjectValue, RelationOptions, WhereObject } from '../types';
import { WhereQueryBuilder } from './where-query-builder';
import { isArrayFull, normalizeColumnName } from '../utils';
import { QueryBuilderHelper } from './query-builder-helper';

/**
 * JoinQueryBuilder class for handling complex relation joins in TypeORM queries.
 * This class converts a structured relation configuration into TypeORM join conditions.
 *
 * Example usage:
 * ```typescript
 * const relations = [
 *   'customer', // simple alias-only join
 *   {
 *     'customer.address': {
 *       select: ['city', 'state'],
 *       where: { city: { $ilike: '%new%' } }
 *     },
 *     'customer.orders': {
 *       select: ['id', 'total'],
 *       joinType: 'inner',
 *       where: {
 *         status: { $in: ['completed', 'shipped'] },
 *         total: { $gt: 1000 }
 *       }
 *     }
 *   }
 * ];
 * ```
 */
export class JoinQueryBuilder<T extends ObjectLiteral> {

    private builder: SelectQueryBuilder<T>;

    constructor(
        private helper: QueryBuilderHelper<T>,
    ) {
        this.builder = this.helper.builder;
    }

    getBuilder() {
        return this.builder;
    }

    /**
    * Builds the complete join configuration and applies it to the query builder
    * @returns The modified SelectQueryBuilder with joins applied
    */
    build(config: RelationOptions): SelectQueryBuilder<T> {
        const joinConfig = this.parseJoinConfig(config);

        // Step 1: Collect all needed relations (including implicit parent relations)
        const allNeededRelations = this.collectAllNeededRelations(joinConfig);

        // Step 2: Sort by depth so parent relations are processed first
        const sortedRelations = Array.from(allNeededRelations).sort((a, b) => {
            const depthA = a.split('.').length;
            const depthB = b.split('.').length;
            return depthA - depthB;
        });

        // Step 3: Process each relation in order
        for (const relationPath of sortedRelations) {
            const config = joinConfig[relationPath] || { joinType: 'left' }; // Use original config or default

            if (typeof config === 'boolean') {
                this.setJoin(relationPath, { joinType: 'left' });
            } else {
                this.setJoin(relationPath, { joinType: 'left', ...config });
            }
        }

        return this.builder;
    }

    /**
     * Collect all relations that need to be joined, including implicit parent relations
     * For example: ['profile.addresses.country'] becomes ['profile', 'profile.addresses', 'profile.addresses.country']
     */
    private collectAllNeededRelations(joinConfig: RelationObject): Set<string> {
        const allRelations = new Set<string>();

        for (const relationPath in joinConfig) {
            const segments = relationPath.split('.');

            // Add all parent paths
            for (let i = 1; i <= segments.length; i++) {
                const currentPath = segments.slice(0, i).join('.');
                allRelations.add(currentPath);
            }
        }

        return allRelations;
    }

    protected setJoin(name: string, options: RelationObjectValue) {
        const segments = name.split('.');

        if (segments.length === 1) {
            // Simple relation: profile
            const allowedRelation = this.helper.getRelationMetadata(name);
            if (!allowedRelation) {
                throw new Error(`Relation '${name}' not found`);
            }

            const relationType = options.joinType === 'inner' ? 'innerJoin' : 'leftJoin';
            const alias = name; // Use simple name as alias: "profile"

            this.builder[relationType](allowedRelation.path, alias);

            let columns: string[] = [];
            if (allowedRelation.allowedColumns) {
                columns = isArrayFull(options.select) && options.select
                    ? options.select.filter((column) => allowedRelation.allowedColumns.some((allowed) => allowed === column))
                    : allowedRelation.allowedColumns;
            }

            const select = new Set(
                [...allowedRelation.primaryColumns, ...columns].map(
                    (col) => `${alias}.${col}`,
                ),
            );

            for (const field of select) {
                this.helper.selectedFields.add(field);
            }
        } else {
            // Nested relation: profile.addresses, profile.addresses.country
            const relationName = segments[segments.length - 1]; // Last segment (addresses, country)
            const parentAlias = segments.slice(0, -1).join('_'); // Parent alias (profile, profile_addresses)
            const currentAlias = name.replace(/\./g, '_'); // Current alias (profile_addresses, profile_addresses_country)

            const relationType = options.joinType === 'inner' ? 'innerJoin' : 'leftJoin';

            // Join syntax: parentAlias.relationName with alias currentAlias
            const joinPath = `${parentAlias}.${relationName}`;
            this.builder[relationType](joinPath, currentAlias);

            // Get relation metadata to determine available columns
            const allowedRelation = this.helper.getRelationMetadata(name);
            if (!allowedRelation) {
                // This might be an intermediate relation that was auto-generated
                // For those, we don't add select columns
                return;
            }

            // Add selected columns
            if (isArrayFull(options.select) && options.select) {
                // Use explicitly provided select columns
                const filteredColumns = allowedRelation.allowedColumns
                    ? options.select.filter((column) => allowedRelation.allowedColumns.some((allowed) => allowed === column))
                    : options.select;

                const select = (filteredColumns || []).map(col => `${currentAlias}.${col}`);
                for (const field of select) {
                    this.helper.selectedFields.add(field);
                }
            } else {
                // No specific select provided - include all available columns

                let columns: string[] = [];
                if (allowedRelation.allowedColumns) {
                    columns = allowedRelation.allowedColumns;
                }
                const select = new Set(
                    [...allowedRelation.primaryColumns, ...columns].map(
                        (col) => `${currentAlias}.${col}`,
                    ),
                );

                for (const field of select) {
                    this.helper.selectedFields.add(field);
                }
            }
        }
    }

    /**
    * Converts various relation config formats into a standardized object format
    * @param joinConfig - Relation configuration in various formats (string, array, or object)
    * @returns Standardized relation object
    *
    * Example:
    * Input: ['customer', { 'orders': { select: ['id'] } }]
    * Output: { 'customer': true, 'orders': { select: ['id'] } }
    */
    private parseJoinConfig(joinConfig: RelationOptions): RelationObject {
        // Handle string format (simple relation name)
        if (typeof joinConfig === 'string') {
            return { [joinConfig]: true };
        }

        // Handle array format (multiple relations)
        if (Array.isArray(joinConfig)) {
            const result: RelationObject = {};
            joinConfig.forEach(config => {
                const relation = this.parseJoinConfig(config);
                Object.assign(result, relation);
            });
            return result;
        }

        // Handle object format (already in correct format)
        return joinConfig as RelationObject;
    }
}
