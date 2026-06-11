import { RelationObject, RelationObjectValue, RelationOptions } from './types';


export class RelationBuilder {

    private relations: RelationObject = {};

    constructor(relations?: RelationOptions | string) {
        if (relations) {
            const relationOptions = typeof relations === 'string' ? JSON.parse(relations) : relations;
            this.setRelations(relationOptions);
        }
    }

    setRelations(relations: RelationOptions): this {
        if (relations) {
            if (Array.isArray(relations)) {
                relations.forEach(relation => {
                    this.add(relation);
                });
            } else if (typeof relations === 'string') {
                this.add(relations);
            } else {
                this.relations = relations;
            }
        }
        return this;
    }

    clear(): this {
        this.relations = {};
        return this;
    }

    /**
     * Add (or replace) a relation. Two call styles, both optional after the name:
     *
     * ```ts
     * builder.add('posts');                                   // join, all columns
     * builder.add('posts', ['id', 'title']);                  // pick columns
     * builder.add('posts', ['id'], { status: 'published' });  // + relation-scoped where
     * builder.add('posts', ['id'], undefined, 'inner');       // + inner join
     * builder.add('posts', { select: ['id'], joinType: 'inner' }); // object config
     * ```
     */
    add(
        relation: string,
        select?: string[] | RelationObjectValue,
        where?: Record<string, any>,
        joinType?: 'left' | 'inner',
    ): this {
        // Object-config form: add('posts', { select, where, joinType })
        if (select && !Array.isArray(select) && typeof select === 'object') {
            const config = select as RelationObjectValue;
            this.relations[relation] = Object.keys(config).length ? { ...config } : true;
            return this;
        }

        // Positional form
        const config: RelationObjectValue = {};
        if (select) {
            config.select = select as string[];
        }
        if (where) {
            config.where = where;
        }
        if (joinType) {
            config.joinType = joinType;
        }
        this.relations[relation] = Object.keys(config).length ? config : true;
        return this;
    }

    remove(relation: string): this {
        delete this.relations[relation];
        return this;
    }

    hasRelations(): boolean {
        return Object.keys(this.relations).length > 0;
    }

    toObject(): RelationObject {
        return this.relations;
    }

    toJson(): string {
        return JSON.stringify(this.relations);
    }

}
