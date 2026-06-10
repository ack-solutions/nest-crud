import { EntityMetadata, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { normalizeColumnName } from '../utils';

/**
 * Shared helper class for query builders to handle common entity metadata,
 * alias resolution, and database operations.
 */
export class QueryBuilderHelper<T extends ObjectLiteral> {

    public selectedFields: Set<string> = new Set();
    public readonly dbType: string;
    public readonly rootAlias: string;
    public readonly entityColumns: string[];
    public readonly entityPrimaryColumns: string[];
    public readonly entityColumnsHash: ObjectLiteral = {};
    public readonly entityHasDeleteColumn: boolean;

    protected readonly entityRelationsHash: Map<string, any> = new Map();

    constructor(
        readonly repository: Repository<T>,
        readonly builder: SelectQueryBuilder<T>
    ) {
        this.rootAlias = builder.alias;
        this.dbType = this.repository.metadata.connection.options.type;

        // Initialize entity columns and metadata
        this.entityColumns = this.initializeEntityColumns();
        this.entityPrimaryColumns = this.initializePrimaryColumns();
        this.entityHasDeleteColumn = this.initializeDeleteColumn();
    }

    /**
     * Initialize entity columns mapping
     */
    private initializeEntityColumns(): string[] {
        return this.repository.metadata.columns.map((prop) => {
            // In case column is an embedded, use the propertyPath to get complete path
            if (prop.embeddedMetadata) {
                this.entityColumnsHash[prop.propertyPath] = prop.databasePath;
                return prop.propertyPath;
            }
            this.entityColumnsHash[prop.propertyName] = prop.databasePath;
            return prop.propertyName;
        });
    }

    /**
     * Initialize primary columns
     */
    private initializePrimaryColumns(): string[] {
        return this.repository.metadata.columns
            .filter((prop) => prop.isPrimary)
            .map((prop) => prop.propertyName);
    }

    /**
     * Check if entity has delete column (soft delete)
     */
    private initializeDeleteColumn(): boolean {
        return this.repository.metadata.columns.filter((prop) => prop.isDeleteDate).length > 0;
    }

    /**
     * Get database-specific identifier quote character
     */
    public getIdentifierQuote(): string {
        return ['mysql', 'mariadb'].includes(this.dbType) ? '`' : '"';
    }

    public cleanFieldName(fieldName: string): string {
        const quote = this.getIdentifierQuote();
        const cleanPart = fieldName.replace(new RegExp(quote, 'g'), '');
        return cleanPart;
    }

    /**
     * Get field with proper alias and normalization
     */
    public getFieldWithAlias(field: string, useDbField: boolean = false): string {
        const quote = this.getIdentifierQuote();
        const cols = field.split('.');

        switch (cols.length) {
            case 1:
                if (useDbField) {
                    const dbColName = this.entityColumnsHash[field] !== field ? this.entityColumnsHash[field] : field;
                    return normalizeColumnName(`${this.rootAlias}.${dbColName}`, quote);
                }
                return normalizeColumnName(`${this.rootAlias}.${field}`, quote);
            default:
                const columnName = cols[cols.length - 1];
                // Convert nested relation path to underscore notation to match JoinQueryBuilder aliases
                // e.g., 'profile.addresses' becomes 'profile_addresses'
                let colAlias = cols.slice(0, -1).join('_');

                const relation = this.getRelationMetadata(field);
                if (relation) {
                    return normalizeColumnName(relation.path, quote);
                }

                // For nested relations, use underscore alias: profile_addresses.city
                return normalizeColumnName(`${colAlias}.${columnName}`, quote);
        }
    }

    /**
     * Get relation metadata for a given field path
     */
    public getRelationMetadata(field: string) {
        try {
            let allowedRelation;
            let nested = false;

            if (this.entityRelationsHash.has(field)) {
                allowedRelation = this.entityRelationsHash.get(field);
            } else {
                const fields = field.split('.');
                let relationMetadata: EntityMetadata | null = null;
                let name: string = '';
                let path: string = '';
                let parentPath: string = '';

                if (fields.length === 1) {
                    const found = this.repository.metadata.relations.find((one) => one.propertyName === fields[0]);

                    if (found) {
                        name = fields[0];
                        path = `${this.rootAlias}.${fields[0]}`;
                        relationMetadata = found.inverseEntityMetadata;
                    }
                } else {
                    nested = true;
                    parentPath = '';

                    const reduced = fields.reduce(
                        (res, propertyName: string, i) => {
                            const found = res.relations.length
                                ? res.relations.find((one) => one.propertyName === propertyName)
                                : null;
                            const relationMetadata = found ? found.inverseEntityMetadata : null;
                            const relations = relationMetadata ? relationMetadata.relations : [];
                            name = propertyName;

                            if (i !== fields.length - 1) {
                                parentPath = !parentPath ? propertyName : `${parentPath}.${propertyName}`;
                            }

                            return {
                                relations,
                                relationMetadata,
                            };
                        },
                        {
                            relations: this.repository.metadata.relations,
                            relationMetadata: null,
                        },
                    );

                    relationMetadata = reduced.relationMetadata;
                }

                if (relationMetadata) {
                    const { columns, primaryColumns } = this.getEntityColumns(relationMetadata);

                    if (!path && parentPath) {
                        const parentAllowedRelation = this.entityRelationsHash.get(parentPath);

                        if (parentAllowedRelation) {
                            // Convert parent alias from dot notation to underscore notation to match JoinQueryBuilder
                            // e.g., 'profile.addresses' becomes 'profile_addresses'
                            const parentAliasWithUnderscore = parentAllowedRelation.alias.replace(/\./g, '_');
                            path = parentAllowedRelation.alias ? `${parentAliasWithUnderscore}.${name}` : field;
                        }
                    }

                    allowedRelation = {
                        alias: field,
                        name,
                        path,
                        columns,
                        nested,
                        primaryColumns,
                    };
                }
            }

            if (allowedRelation) {
                const allowedColumns = allowedRelation.columns;
                const toSave = { ...allowedRelation, allowedColumns };

                this.entityRelationsHash.set(field, toSave);

                return toSave;
            }
        } catch (_) {
            return null;
        }
    }

    /**
     * Validate a where/order field path against the entity's columns and relations.
     * A root-level key must be a known column; a dotted path must walk valid
     * relations to a real column on the related entity. Used to reject unknown or
     * hand-crafted keys with a clean 400 instead of leaking a database error
     * (identifiers are also quoted downstream, so this is defense-in-depth).
     */
    public isAllowedField(field: string): boolean {
        if (!field || typeof field !== 'string') {
            return false;
        }
        // Accept any known column first — this also covers embedded-column paths
        // such as 'name.first' (stored in entityColumns as a dotted propertyPath).
        if (this.entityColumns.includes(field)) {
            return true;
        }
        const parts = field.split('.');
        if (parts.length === 1) {
            return false;
        }
        let metadata = this.repository.metadata;
        for (let i = 0; i < parts.length - 1; i++) {
            const relation = metadata.relations.find((rel) => rel.propertyName === parts[i]);
            if (!relation) {
                return false;
            }
            metadata = relation.inverseEntityMetadata;
        }
        const last = parts[parts.length - 1];
        return metadata.columns.some((col) => col.propertyName === last || col.propertyPath === last);
    }

    /**
     * Get entity columns and primary columns from metadata
     */
    public getEntityColumns(entityMetadata: EntityMetadata): { columns: string[]; primaryColumns: string[] } {
        const columns = entityMetadata.columns.map((prop) => prop.propertyPath) || [];
        const primaryColumns = entityMetadata.primaryColumns.map((prop) => prop.propertyPath) || [];

        return { columns, primaryColumns };
    }

}
