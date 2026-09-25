import { EntityMetadata } from 'typeorm';

// Derived from the public EntityMetadata type — no deep import into typeorm internals.
type ColumnMetadata = EntityMetadata['columns'][number];
type RelationMetadata = EntityMetadata['relations'][number];

/**
 * Columns the database or TypeORM owns: the generated primary key and the
 * create / update / delete date and version columns. A client must never set
 * these on a new row.
 */
function serverManagedColumns(metadata: EntityMetadata, includePrimary: boolean): ColumnMetadata[] {
    const columns = [
        ...(includePrimary ? metadata.primaryColumns.filter((c) => c.isGenerated) : []),
        metadata.createDateColumn,
        metadata.updateDateColumn,
        metadata.deleteDateColumn,
        metadata.versionColumn,
    ].filter(Boolean) as ColumnMetadata[];
    // Embedded columns have a nested path; only top-level properties can be dropped here.
    return columns.filter((c) => !c.embeddedMetadata);
}

/**
 * A child row this entity owns: the related row holds the foreign key back to us
 * (one-to-many, or the inverse side of a one-to-one). Saving it through the parent
 * with an existing id would move that row under the new parent.
 */
function isOwnedChild(relation: RelationMetadata): boolean {
    return relation.isOneToMany || relation.isOneToOneNotOwner;
}

function strip(metadata: EntityMetadata, data: any, includePrimary: boolean, recurse: boolean): any {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return data;
    }
    const out: any = { ...data };
    for (const column of serverManagedColumns(metadata, includePrimary)) {
        delete out[column.propertyName];
    }
    if (recurse) {
        for (const relation of metadata.relations) {
            if (!isOwnedChild(relation)) continue;
            const value = out[relation.propertyName];
            if (value === undefined || value === null) continue;
            const child = relation.inverseEntityMetadata;
            out[relation.propertyName] = Array.isArray(value)
                ? value.map((row) => strip(child, row, true, true))
                : strip(child, value, true, true);
        }
    }
    return out;
}

/**
 * Prepare a request body to be **inserted** as a new row: returns a copy with the
 * generated primary key and the create / update / delete date and version columns
 * removed — from the row itself and, recursively, from every owned child row
 * (one-to-many arrays and inverse one-to-one objects).
 *
 * Without this, `repository.save()` treats a body `id` as "update that row": a
 * `POST` carrying another tenant's id would overwrite it, and a child sent with an
 * id would be moved under the new parent.
 *
 * References keep their ids — many-to-one objects, the owning side of a one-to-one,
 * many-to-many links, and plain `...Id` columns — because they point at existing
 * rows rather than create them. A primary key the client must supply (a
 * non-generated `@PrimaryColumn`) is kept as well.
 *
 * `CrudService.create()` / `createMany()` apply this automatically; use it in your
 * own (non-CRUD) create paths too:
 *
 * ```ts
 * const row = stripServerManagedFields(this.repository.metadata, body);
 * await this.repository.save(this.repository.create(row));
 * ```
 */
export function stripServerManagedFields<D>(metadata: EntityMetadata, data: D): D {
    return strip(metadata, data, true, true);
}

/**
 * Remove the create / update / delete date and version columns from a body for an
 * **update** (top level only — child rows in an update may legitimately carry
 * their ids). The primary key is left for the caller to set from the stored row.
 */
export function stripAuditFields<D>(metadata: EntityMetadata, data: D): D {
    return strip(metadata, data, false, false);
}
