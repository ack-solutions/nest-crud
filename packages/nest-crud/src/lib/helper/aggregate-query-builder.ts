import { BadRequestException } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';

import { IFindManyOptions } from '../interface/crud';
import { OrderDirectionEnum, RelationObject, RelationObjectValue, RelationOptions, WhereOptions } from '../types';
import { QueryBuilderHelper } from './query-builder-helper';
import { JoinQueryBuilder } from './join-query-builder';
import { WhereQueryBuilder, LhsResolver } from './where-query-builder';
import { FindQueryBuilder } from './find-query-builder';

/**
 * Executes a list query that carries user-defined aggregates (count/sum/avg/min/max
 * over a relation) using a **two-phase derived-table** strategy:
 *
 *  1. Build an inner query that selects the primary key plus one **correlated scalar
 *     subquery per aggregate**. Wrap it once as a derived table `t` and apply
 *     `having` (filter on aggregate aliases), `order` (root columns + aggregate
 *     aliases) and `LIMIT/OFFSET` against real derived **columns** — robust on
 *     Postgres / MySQL / SQLite, with each subquery written exactly once.
 *     `total` is `COUNT(*)` over the same derived table.
 *  2. Reload the full entities for the page by primary key (with the requested
 *     relations / select), restore phase-1 order, and merge each aggregate value
 *     onto its entity (`user.postCount`).
 *
 * Scalar subqueries do not multiply rows, so combining aggregates with `relations`
 * never inflates a SUM/COUNT. The non-aggregate path is untouched — this runs only
 * when {@link AggregateQueryBuilder.has} is true.
 */
export class AggregateQueryBuilder<T extends ObjectLiteral> {

    constructor(private readonly repository: Repository<T>) {}

    /** True when the options request at least one aggregate. */
    static has(options?: IFindManyOptions): boolean {
        return !!options && Array.isArray(options.aggregates) && options.aggregates.length > 0;
    }

    async getManyAndCount(options: IFindManyOptions): Promise<{ items: T[]; total: number }> {
        const meta = this.repository.metadata;
        const pkProp = meta.primaryColumns[0].propertyName;
        const pkDb = meta.primaryColumns[0].databaseName;

        // ---- Phase 1: inner query of { pk, ...aggregate subqueries } ----
        const inner = this.repository.createQueryBuilder(meta.targetName);
        const helper = new QueryBuilderHelper(this.repository, inner);
        const quote = helper.getIdentifierQuote();
        const q = (id: string) => `${quote}${id}${quote}`;

        // Soft-delete handling mirrors FindQueryBuilder.
        if (options.withDeleted) {
            inner.withDeleted();
        }
        if (options.onlyDeleted && meta.deleteDateColumn) {
            inner.withDeleted();
            inner.andWhere(`${inner.alias}.${meta.deleteDateColumn.propertyName} IS NOT NULL`);
        }

        // Only join relations when a row filter actually needs them (keeps phase 1 light).
        const joined = !!options.relations && this.needsRowJoins(options);
        if (joined) {
            new JoinQueryBuilder(helper).build(options.relations as RelationOptions);
        }
        if (options.where) {
            new WhereQueryBuilder(helper).build(options.where);
        }

        // SELECT pk
        inner.select(`${q(inner.alias)}.${q(pkDb)}`, 'pk');

        // Compile each aggregate to a correlated scalar subquery.
        const compiled = (options.aggregates || []).map((spec) => helper.compileAggregate(spec));
        const aggAliases = new Set(compiled.map((c) => c.as));

        // Plan ordering: aggregate alias → derived column directly; root column →
        // select it into the derived table under a private alias and order by that.
        const order = options.order || {};
        const orderPlan: Array<{ alias: string; dir: OrderDirectionEnum }> = [];
        for (const key of Object.keys(order)) {
            if (aggAliases.has(key)) {
                orderPlan.push({ alias: key, dir: order[key] });
                continue;
            }
            if (helper.visibleColumns.includes(key) && !key.includes('.')) {
                const derivedAlias = `ord_${key}`;
                inner.addSelect(helper.getFieldWithAlias(key), derivedAlias);
                orderPlan.push({ alias: derivedAlias, dir: order[key] });
                continue;
            }
            throw new BadRequestException(
                `Cannot order an aggregate query by '${key}' — only root columns and aggregate aliases are supported`,
            );
        }

        // Add each aggregate subquery, splicing in an optional per-aggregate `where`
        // (filters the related rows using the same operator engine as a normal where).
        const aggParams: Record<string, any> = {};
        const specs = options.aggregates || [];
        for (let i = 0; i < compiled.length; i++) {
            const c = compiled[i];
            let subquery = c.sql;
            if (specs[i].where) {
                const filter = this.compileAggregateWhere(helper, c, specs[i].where as WhereOptions);
                if (filter.query) {
                    subquery = `${c.sql} AND (${filter.query})`;
                    Object.assign(aggParams, filter.params);
                }
            }
            inner.addSelect(`(${subquery})`, c.as);
        }
        if (Object.keys(aggParams).length) {
            inner.setParameters({ ...inner.getParameters(), ...aggParams });
        }

        // Collapse any join fan-out; scalar subqueries and root columns stay valid
        // under GROUP BY the primary key on all three engines.
        if (joined) {
            inner.groupBy(`${q(inner.alias)}.${q(pkDb)}`);
        }

        const innerSql = inner.getQuery();
        const innerParams = inner.getParameters();

        // ---- Compile HAVING once against the derived aggregate columns ----
        let havingQuery = '';
        let havingParams: Record<string, any> = {};
        if (options.having) {
            const havingBuilder = new WhereQueryBuilder(helper);
            havingBuilder.setParamsPrefix('having_param_');
            const resolver: LhsResolver = (key) =>
                aggAliases.has(key)
                    ? { expr: `t.${q(key)}`, allowed: true }
                    : { expr: '', allowed: false };
            const compiledHaving = havingBuilder.buildWhereQueryAndParams(options.having, resolver);
            havingQuery = compiledHaving.query;
            havingParams = compiledHaving.params;
        }

        // ---- total = COUNT(*) over the derived table (with HAVING) ----
        const countQb = this.repository.manager.connection.createQueryBuilder();
        countQb.select('COUNT(1)', 'cnt').from(`(${innerSql})`, 't').setParameters(innerParams);
        if (havingQuery) {
            countQb.andWhere(havingQuery, havingParams);
        }
        const totalRaw = await countQb.getRawOne<{ cnt: any }>();
        const total = Number(totalRaw?.cnt) || 0;

        // ---- page of { pk, ...aggregates } ----
        const pageQb = this.repository.manager.connection.createQueryBuilder();
        pageQb.select(`t.${q('pk')}`, 'pk').from(`(${innerSql})`, 't').setParameters(innerParams);
        for (const c of compiled) {
            pageQb.addSelect(`t.${q(c.as)}`, c.as);
        }
        if (havingQuery) {
            pageQb.andWhere(havingQuery, havingParams);
        }
        for (const o of orderPlan) {
            pageQb.addOrderBy(`t.${q(o.alias)}`, o.dir);
        }
        if (options.take !== undefined) {
            pageQb.limit(Number(options.take));
        }
        if (options.skip !== undefined) {
            pageQb.offset(Number(options.skip));
        }

        const pageRows = await pageQb.getRawMany<Record<string, any>>();
        if (pageRows.length === 0) {
            return { items: [], total };
        }
        const pageIds = pageRows.map((r) => r.pk);

        // ---- Phase 2: reload entities by pk, restore order, merge aggregates ----
        const hydrate = new FindQueryBuilder(this.repository);
        hydrate.build({
            where: { [pkProp]: { $in: pageIds } },
            relations: options.relations,
            select: options.select,
            // The page pks were already vetted in phase 1; load them regardless of
            // soft-delete state so an onlyDeleted/withDeleted page still hydrates.
            withDeleted: true,
        });
        const entities = await hydrate.getMany();

        const byId = new Map(entities.map((e) => [String((e as any)[pkProp]), e]));
        const aggByPk = new Map(pageRows.map((r) => [String(r.pk), r]));

        const items: T[] = [];
        for (const id of pageIds) {
            const entity = byId.get(String(id));
            if (!entity) {
                continue;
            }
            const raw = aggByPk.get(String(id));
            for (const c of compiled) {
                (entity as any)[c.as] = this.coerce(raw?.[c.as], c.numeric);
            }
            items.push(entity);
        }

        return { items, total };
    }

    /**
     * Compile a per-aggregate `where` against the related rows using the same
     * operator engine as a normal `where`. Filter keys are columns of the related
     * entity (hidden ones excluded); the resolver maps each to the subquery's child
     * alias. A unique param prefix avoids collisions across aggregates and the
     * outer query.
     */
    private compileAggregateWhere(
        helper: QueryBuilderHelper<T>,
        compiled: { as: string; alias: string; relationPath: string },
        where: WhereOptions,
    ): { query: string; params: Record<string, any> } {
        const relation = this.repository.metadata.relations.find((r) => r.propertyName === compiled.relationPath);
        const childMeta = relation?.inverseEntityMetadata;
        const hidden = helper.relationHiddenFields(compiled.relationPath);
        const quote = helper.getIdentifierQuote();

        const resolver: LhsResolver = (key) => {
            if (hidden.has(key)) {
                return { expr: '', allowed: false };
            }
            const col = childMeta?.columns.find((c) => c.propertyName === key || c.propertyPath === key);
            if (!col) {
                return { expr: '', allowed: false };
            }
            return { expr: `${quote}${compiled.alias}${quote}.${quote}${col.databaseName}${quote}`, allowed: true };
        };

        const wb = new WhereQueryBuilder(helper);
        wb.setParamsPrefix(`agg_${compiled.as}_param_`);
        return wb.buildWhereQueryAndParams(where, resolver);
    }

    /** Coerce a raw aggregate value: numbers for count/sum/avg (+ numeric min/max), else verbatim. */
    private coerce(value: any, numeric: boolean): any {
        if (value === null || value === undefined) {
            return null;
        }
        if (!numeric) {
            return value;
        }
        const n = Number(value);
        return Number.isNaN(n) ? null : n;
    }

    /**
     * Phase 1 only needs to join relations when a row filter references them:
     * either a top-level `where` key that starts with a relation name, or a
     * relation-scoped `where` block in the relations config.
     */
    private needsRowJoins(options: IFindManyOptions): boolean {
        return this.whereReferencesRelation(options.where) || this.relationsHaveWhere(options.relations);
    }

    private whereReferencesRelation(where: any): boolean {
        if (!where || typeof where !== 'object') {
            return false;
        }
        const relationNames = new Set(this.repository.metadata.relations.map((r) => r.propertyName));
        const scan = (node: any): boolean => {
            if (!node || typeof node !== 'object') {
                return false;
            }
            if (Array.isArray(node)) {
                return node.some(scan);
            }
            for (const key of Object.keys(node)) {
                if (key === '$and' || key === '$or') {
                    if (scan(node[key])) {
                        return true;
                    }
                    continue;
                }
                if (key.includes('.') && relationNames.has(key.split('.')[0])) {
                    return true;
                }
            }
            return false;
        };
        return scan(where);
    }

    private relationsHaveWhere(relations?: RelationOptions): boolean {
        if (!relations || typeof relations === 'string') {
            return false;
        }
        if (Array.isArray(relations)) {
            return relations.some((r) => typeof r !== 'string' && this.relationObjectHasWhere(r));
        }
        return this.relationObjectHasWhere(relations);
    }

    private relationObjectHasWhere(obj: RelationObject): boolean {
        for (const key of Object.keys(obj)) {
            const value = obj[key] as RelationObjectValue | boolean;
            if (value && typeof value === 'object' && value.where) {
                const w = value.where;
                if (Array.isArray(w) ? w.length > 0 : Object.keys(w).length > 0) {
                    return true;
                }
            }
        }
        return false;
    }
}
