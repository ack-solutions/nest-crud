import {
    QueryBuilder,
    WhereOperatorEnum,
    OrderDirectionEnum,
    AggregateFnEnum,
} from '../index';

/**
 * REQUEST CONTRACT — the exact params the builder puts on the wire.
 *
 * `toObject()` is what you hand to `URLSearchParams` / `axios({ params })`, so these
 * assertions pin the actual HTTP request shape the `@ackplus/nest-crud` server
 * parses. If you intentionally change how a query serialises, update these tests in
 * the same change — a diff here means the request contract moved.
 */

/** Decode a params object into a stable, order-independent set of `key=value` pairs. */
function pairs(params: Record<string, any>): string[] {
    return decodeURIComponent(new URLSearchParams(params as Record<string, string>).toString())
        .split('&')
        .filter(Boolean)
        .sort();
}

describe('Request output contract (HTTP params)', () => {
    describe('filters', () => {
        it('equality shorthand + pagination', () => {
            const params = new QueryBuilder()
                .where('status', 'active')
                .setTake(20)
                .setSkip(0)
                .toObject();

            expect(params).toEqual({
                where: '{"status":{"$eq":"active"}}',
                take: 20,
                skip: 0,
            });
            expect(pairs(params)).toEqual(
                ['skip=0', 'take=20', 'where={"status":{"$eq":"active"}}'].sort(),
            );
        });

        it('explicit operator + multiple conditions (implicit AND via repeated where)', () => {
            const params = new QueryBuilder()
                .where('age', WhereOperatorEnum.GT_OR_EQ, 18)
                .where('age', WhereOperatorEnum.LT, 65)
                .toObject();

            expect(params).toEqual({ where: '{"age":{"$gte":18,"$lt":65}}' });
        });

        it('explicit AND / OR composition', () => {
            const params = new QueryBuilder()
                .where('status', 'active')
                .orWhere('role', 'admin')
                .andWhere('verified', true)
                .toObject(true);

            expect(params.where).toEqual({
                status: { $eq: 'active' },
                $or: [{ role: { $eq: 'admin' } }],
                $and: [{ verified: { $eq: true } }],
            });
        });

        it('grouped condition via a nested callback', () => {
            const params = new QueryBuilder()
                .where((b) => {
                    b.where('firstName', WhereOperatorEnum.ILIKE, '%jo%');
                    b.orWhere('lastName', WhereOperatorEnum.ILIKE, '%jo%');
                })
                .toObject(true);

            expect(params.where).toEqual({
                firstName: { $iLike: '%jo%' },
                $or: [{ lastName: { $iLike: '%jo%' } }],
            });
        });

        it('value-less and relation-existence operators', () => {
            const params = new QueryBuilder()
                .where('deletedAt', WhereOperatorEnum.IS_NULL)
                .where('posts', WhereOperatorEnum.EXISTS, true)
                .toObject(true);

            expect(params.where).toEqual({
                deletedAt: { $isNull: true },
                posts: { $exists: true },
            });
        });
    });

    describe('every operator serialises to its token', () => {
        // Guards the full operator surface — a renamed/removed token breaks here.
        const cases: Array<[WhereOperatorEnum, any]> = [
            [WhereOperatorEnum.EQ, 'a'],
            [WhereOperatorEnum.NOT_EQ, 'a'],
            [WhereOperatorEnum.IEQ, 'a'],
            [WhereOperatorEnum.GT, 1],
            [WhereOperatorEnum.GT_OR_EQ, 1],
            [WhereOperatorEnum.LT, 1],
            [WhereOperatorEnum.LT_OR_EQ, 1],
            [WhereOperatorEnum.IN, ['a', 'b']],
            [WhereOperatorEnum.NOT_IN, ['a', 'b']],
            [WhereOperatorEnum.LIKE, '%a%'],
            [WhereOperatorEnum.NOT_LIKE, '%a%'],
            [WhereOperatorEnum.ILIKE, '%a%'],
            [WhereOperatorEnum.NOT_ILIKE, '%a%'],
            [WhereOperatorEnum.STARTS_WITH, 'a'],
            [WhereOperatorEnum.ENDS_WITH, 'a'],
            [WhereOperatorEnum.ISTARTS_WITH, 'a'],
            [WhereOperatorEnum.IENDS_WITH, 'a'],
            [WhereOperatorEnum.IN_L, ['a']],
            [WhereOperatorEnum.NOT_IN_L, ['a']],
            [WhereOperatorEnum.CONT_ARR, ['a']],
            [WhereOperatorEnum.INTERSECTS_ARR, ['a']],
            [WhereOperatorEnum.IS_NULL, true],
            [WhereOperatorEnum.IS_NOT_NULL, true],
            [WhereOperatorEnum.BETWEEN, [1, 9]],
            [WhereOperatorEnum.NOT_BETWEEN, [1, 9]],
            [WhereOperatorEnum.IS_TRUE, true],
            [WhereOperatorEnum.IS_FALSE, true],
            [WhereOperatorEnum.EXISTS, true],
            [WhereOperatorEnum.NOT_EXISTS, true],
        ];

        it.each(cases)('%s', (operator, value) => {
            const where = new QueryBuilder().where('field', operator, value).toObject(true).where;
            expect(where).toEqual({ field: { [operator]: value } });
        });
    });

    describe('relations', () => {
        it('array names, object config, and joinType', () => {
            const params = new QueryBuilder()
                .addRelation('profile')
                .addRelation('posts', ['id', 'title'], { status: 'published' }, 'inner')
                .addRelation('tags', { joinType: 'inner' })
                .toObject(true);

            expect(params.relations).toEqual({
                profile: true,
                posts: { select: ['id', 'title'], where: { status: 'published' }, joinType: 'inner' },
                tags: { joinType: 'inner' },
            });
        });
    });

    describe('select, order, pagination, soft-delete', () => {
        it('serialises each section', () => {
            const params = new QueryBuilder()
                .addSelect(['id', 'name'])
                .addOrder('createdAt', OrderDirectionEnum.DESC)
                .addOrder('name', OrderDirectionEnum.ASC)
                .setTake(10)
                .setSkip(30)
                .setWithDeleted(true)
                .setOnlyDeleted(true)
                .toObject();

            expect(params).toEqual({
                select: '["id","name"]',
                order: '{"createdAt":"DESC","name":"ASC"}',
                take: 10,
                skip: 30,
                withDeleted: true,
                onlyDeleted: true,
            });
        });
    });

    describe('aggregates + having', () => {
        it('serialises aggregates/having/order for the list endpoint', () => {
            const params = new QueryBuilder()
                .addAggregate({ fn: AggregateFnEnum.COUNT, field: 'posts.id', as: 'postCount' })
                .addAggregate({ fn: AggregateFnEnum.SUM, field: 'posts.likes', as: 'totalLikes' })
                .having('postCount', WhereOperatorEnum.GT, 5)
                .addOrder('postCount', OrderDirectionEnum.DESC)
                .toObject();

            expect(params).toEqual({
                aggregates: '[{"fn":"count","field":"posts.id","as":"postCount"},{"fn":"sum","field":"posts.likes","as":"totalLikes"}]',
                having: '{"postCount":{"$gt":5}}',
                order: '{"postCount":"DESC"}',
            });
        });
    });

    describe('custom keys + empties', () => {
        it('forwards custom keys via set() and omits empty sections', () => {
            const params = new QueryBuilder()
                .set('search', 'alice')
                .set('tenantId', 'acme')
                .where(() => {
                    /* no conditions added */
                })
                .toObject();

            expect(params).toEqual({ search: 'alice', tenantId: 'acme' });
            expect(params.where).toBeUndefined();
        });
    });

    describe('kitchen sink → full request', () => {
        it('produces the complete param set and query string', () => {
            const params = new QueryBuilder()
                .where('status', 'active')
                .addRelation('posts', ['id'])
                .addSelect(['id', 'name'])
                .addOrder('createdAt', OrderDirectionEnum.DESC)
                .setTake(25)
                .setSkip(50)
                .toObject();

            expect(pairs(params)).toEqual(
                [
                    'where={"status":{"$eq":"active"}}',
                    'relations={"posts":{"select":["id"]}}',
                    'select=["id","name"]',
                    'order={"createdAt":"DESC"}',
                    'take=25',
                    'skip=50',
                ].sort(),
            );
        });
    });

    describe('round-trip stability', () => {
        it('toObject(true) → new QueryBuilder(...) → toObject(true) is stable', () => {
            const original = new QueryBuilder()
                .where('status', 'active')
                .addRelation('posts', ['id'])
                .addAggregate({ fn: AggregateFnEnum.COUNT, field: 'posts.id', as: 'postCount' })
                .having('postCount', WhereOperatorEnum.GT, 1)
                .addOrder('postCount', OrderDirectionEnum.DESC)
                .setTake(20)
                .toObject(true);

            const restored = new QueryBuilder(original as any).toObject(true);
            expect(restored).toEqual(original);
        });
    });
});
