import 'reflect-metadata';

/**
 * Metadata key holding the set of hidden property names for an entity class.
 * Using a global symbol so the value is shared even if the module is duplicated.
 */
const HIDDEN_FIELDS = Symbol.for('ackplus:crud:hiddenFields');

/**
 * Register a property (column or relation) as hidden for an entity class.
 * Used by both the {@link CrudHidden} decorator and the `@Crud({ hiddenFields })`
 * option so the two mechanisms share one source of truth.
 */
export function addHiddenField(entityClass: any, field: string): void {
    if (!entityClass || !field) {
        return;
    }
    const own: Set<string> = Reflect.getOwnMetadata(HIDDEN_FIELDS, entityClass) || new Set<string>();
    own.add(field);
    Reflect.defineMetadata(HIDDEN_FIELDS, own, entityClass);
}

/**
 * Mark an entity **column or relation** as hidden from all CRUD queries: it is
 * dropped from responses (default and explicit `select`) and cannot be used in
 * `where`, `order`, `aggregates`, or `relations` — an attempt is rejected with a
 * `400` exactly like an unknown field, so the field's existence is not revealed.
 *
 * ```ts
 * @Entity()
 * class User extends BaseEntity {
 *   @Column() @CrudHidden() passwordHash: string;   // never selectable/filterable
 *   @OneToMany(() => AuditLog, a => a.user) @CrudHidden() auditLogs: AuditLog[];
 * }
 * ```
 *
 * For per-controller hiding without touching the entity, use
 * `@Crud({ hiddenFields: ['passwordHash'] })`.
 */
export function CrudHidden(): PropertyDecorator {
    return (target, propertyKey) => {
        addHiddenField(target.constructor, propertyKey as string);
    };
}

/**
 * All hidden property names for an entity class, including those inherited from
 * base classes (e.g. a shared `BaseEntity`).
 */
export function getHiddenFields(entityClass: any): Set<string> {
    const result = new Set<string>();
    let proto = entityClass;
    while (proto && proto !== Object && proto !== Function.prototype) {
        const own: Set<string> | undefined = Reflect.getOwnMetadata(HIDDEN_FIELDS, proto);
        if (own) {
            own.forEach((field) => result.add(field));
        }
        proto = Object.getPrototypeOf(proto);
    }
    return result;
}
