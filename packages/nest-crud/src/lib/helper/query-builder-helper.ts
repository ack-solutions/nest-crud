import { BadRequestException } from '@nestjs/common';
import { EntityMetadata, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { normalizeColumnName } from '../utils';
import { AggregateSpec } from '../types';
import { getHiddenFields } from '../decorator/crud-hidden.decorator';

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

    /** Hidden columns/relations on the root entity (`@CrudHidden()` / `hiddenFields`). */
    public readonly hiddenRootFields: Set<string>;

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
        this.hiddenRootFields = getHiddenFields(this.repository.metadata.target);
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
        // Hidden columns/relations are treated as if they do not exist, so a request
        // that references one is rejected exactly like an unknown field (no leak).
        if (this.isHiddenField(field)) {
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
     * Whether a field path touches a hidden column/relation at any segment — a hidden
     * relation, or a hidden column on the root or a related entity. Declared via
     * `@CrudHidden()` or `@Crud({ hiddenFields })`.
     */
    public isHiddenField(field: string): boolean {
        if (!field || typeof field !== 'string') {
            return false;
        }
        const parts = field.split('.');
        let metadata: EntityMetadata = this.repository.metadata;
        let hidden = this.hiddenRootFields;
        for (let i = 0; i < parts.length; i++) {
            if (hidden.has(parts[i])) {
                return true;
            }
            const relation = metadata.relations.find((rel) => rel.propertyName === parts[i]);
            if (!relation) {
                break;
            }
            metadata = relation.inverseEntityMetadata;
            hidden = getHiddenFields(metadata.target);
        }
        return false;
    }

    /** Root entity columns minus hidden ones — the default (no explicit select) projection. */
    public get visibleColumns(): string[] {
        return this.hiddenRootFields.size
            ? this.entityColumns.filter((col) => !this.hiddenRootFields.has(col))
            : this.entityColumns;
    }

    /** Non-hidden columns of a related entity reached at `relationPath`. */
    public visibleRelationColumns(relationPath: string, columns: string[]): string[] {
        const hidden = this.relationHiddenFields(relationPath);
        return hidden.size ? columns.filter((col) => !hidden.has(col)) : columns;
    }

    /** Hidden columns/relations declared on the entity at the end of `relationPath`. */
    public relationHiddenFields(relationPath: string): Set<string> {
        let metadata: EntityMetadata | null = this.repository.metadata;
        for (const segment of relationPath.split('.')) {
            const relation = metadata?.relations.find((rel) => rel.propertyName === segment);
            if (!relation) {
                return new Set<string>();
            }
            metadata = relation.inverseEntityMetadata;
        }
        return metadata ? getHiddenFields(metadata.target) : new Set<string>();
    }

    /**
     * An aggregate field must be relation-qualified (`posts.id`) and resolve to a
     * real column reached through real relations — same allowlist walk as a where key.
     */
    public isAllowedAggregateField(field: string): boolean {
        return typeof field === 'string' && field.includes('.') && this.isAllowedField(field);
    }

    /**
     * Build the pieces of a correlated scalar subquery for an aggregate over a
     * single-level relation: the related table, a unique child alias, and the
     * `child.fk = root.pk` join condition (derived from `RelationMetadata`).
     *
     * Supports to-one / one-to-many (FK on either side). Many-to-many is rejected
     * (it needs a junction join — a documented limitation for now).
     */
    public correlation(relationPath: string): { table: string; alias: string; condition: string } {
        const relation = this.repository.metadata.relations.find((rel) => rel.propertyName === relationPath);
        if (!relation) {
            throw new BadRequestException(`Unknown relation '${relationPath}' for aggregate`);
        }
        if (relation.isManyToMany) {
            throw new BadRequestException(`Aggregates over many-to-many relations are not supported ('${relationPath}')`);
        }

        // The FK lives on the child for one-to-many / inverse one-to-one; otherwise
        // it lives on the root (many-to-one / owning one-to-one).
        const fkOnChild = relation.isOneToMany || relation.isOneToOneNotOwner;
        const joinColumns = fkOnChild ? relation.inverseRelation?.joinColumns : relation.joinColumns;
        if (!joinColumns || joinColumns.length === 0) {
            throw new BadRequestException(`Cannot build an aggregate for relation '${relationPath}'`);
        }

        const quote = this.getIdentifierQuote();
        const q = (id: string) => `${quote}${id}${quote}`;
        const alias = `agg_${relationPath.replace(/[^A-Za-z0-9_]/g, '_')}`;
        const condition = joinColumns
            .map((jc) => {
                const childCol = fkOnChild ? jc.databaseName : jc.referencedColumn!.databaseName;
                const rootCol = fkOnChild ? jc.referencedColumn!.databaseName : jc.databaseName;
                return `${q(alias)}.${q(childCol)} = ${q(this.rootAlias)}.${q(rootCol)}`;
            })
            .join(' AND ');

        return { table: relation.inverseEntityMetadata.tableName, alias, condition };
    }

    /**
     * Compile an {@link AggregateSpec} into a correlated scalar subquery string.
     * `count`/`sum` are wrapped in `COALESCE(…, 0)` (empty set → 0); `avg`/`min`/`max`
     * stay NULL (undefined over an empty set). Returns the SQL plus the alias and a
     * `numeric` flag — true when the raw string result should be coerced to a number
     * (`count`/`sum`/`avg`, and `min`/`max` over a numeric column; `min`/`max` over a
     * date/string column are returned verbatim).
     */
    public compileAggregate(spec: AggregateSpec): { as: string; sql: string; numeric: boolean; alias: string; relationPath: string } {
        if (!spec || typeof spec.as !== 'string' || typeof spec.field !== 'string') {
            throw new BadRequestException('Invalid aggregate spec');
        }
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(spec.as)) {
            throw new BadRequestException(`Invalid aggregate alias: '${spec.as}'`);
        }
        if (this.entityColumns.includes(spec.as)) {
            throw new BadRequestException(`Aggregate alias '${spec.as}' collides with an entity column`);
        }
        if (!this.isAllowedAggregateField(spec.field)) {
            throw new BadRequestException(`Invalid aggregate field: '${spec.field}'`);
        }

        const parts = spec.field.split('.');
        const column = parts[parts.length - 1];
        const relationPath = parts.slice(0, -1).join('.');
        const fn = String(spec.fn).toLowerCase();

        const { table, alias, condition } = this.correlation(relationPath);
        const quote = this.getIdentifierQuote();
        const col = `${quote}${alias}${quote}.${quote}${column}${quote}`;

        let inner: string;
        switch (fn) {
            case 'count': inner = `COUNT(${spec.distinct ? 'DISTINCT ' : ''}${col})`; break;
            case 'sum': inner = `SUM(${col})`; break;
            case 'avg': inner = `AVG(${col})`; break;
            case 'min': inner = `MIN(${col})`; break;
            case 'max': inner = `MAX(${col})`; break;
            default: throw new BadRequestException(`Unsupported aggregate function: '${spec.fn}'`);
        }

        const expr = fn === 'count' || fn === 'sum' ? `COALESCE(${inner}, 0)` : inner;
        // The subquery ends in its correlation WHERE; an optional per-aggregate
        // filter is appended (as ` AND (...)`) by the AggregateQueryBuilder.
        const sql = `SELECT ${expr} FROM ${quote}${table}${quote} ${quote}${alias}${quote} WHERE ${condition}`;
        return { as: spec.as, sql, numeric: this.isNumericAggregate(fn, relationPath, column), alias, relationPath };
    }

    /** Whether an aggregate's raw result should be coerced to a JS number. */
    private isNumericAggregate(fn: string, relationPath: string, column: string): boolean {
        if (fn === 'count' || fn === 'sum' || fn === 'avg') {
            return true;
        }
        // min/max: coerce only when the underlying column is numeric (preserve dates/strings).
        const relation = this.repository.metadata.relations.find((rel) => rel.propertyName === relationPath);
        const colMeta = relation?.inverseEntityMetadata.columns.find(
            (c) => c.propertyName === column || c.propertyPath === column,
        );
        if (!colMeta) {
            return false;
        }
        if (colMeta.type === Number) {
            return true;
        }
        const numericTypes = ['int', 'smallint', 'bigint', 'tinyint', 'mediumint', 'float', 'double', 'decimal', 'numeric', 'real', 'dec', 'fixed'];
        const colType = String(colMeta.type).toLowerCase();
        return numericTypes.some((t) => colType.includes(t));
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
