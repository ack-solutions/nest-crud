import { QueryBuilder } from '../lib/query-builder';
import { RelationBuilder } from '../lib/relation-builder';
import { AggregateFnEnum, OrderDirectionEnum, WhereOperatorEnum } from '../lib/types';

/**
 * v2.1 client features: relation `joinType`, object-config relations, and the
 * aggregates / having serialisation.
 */
describe('QueryBuilder (v2.1 features)', () => {
    let qb: QueryBuilder;

    beforeEach(() => {
        qb = new QueryBuilder({});
    });

    describe('relation joinType + object config', () => {
        it('adds joinType via the positional argument', () => {
            qb.addRelation('posts', ['id'], undefined, 'inner');
            expect(qb.toObject(true).relations).toEqual({
                posts: { select: ['id'], joinType: 'inner' },
            });
        });

        it('adds a relation via an object config', () => {
            qb.addRelation('posts', { select: ['id', 'title'], where: { status: 'published' }, joinType: 'inner' });
            expect(qb.toObject(true).relations).toEqual({
                posts: { select: ['id', 'title'], where: { status: 'published' }, joinType: 'inner' },
            });
        });

        it('keeps the simple array form working (no regression)', () => {
            qb.addRelation('profile', ['bio']);
            qb.addRelation('tags');
            expect(qb.toObject(true).relations).toEqual({
                profile: { select: ['bio'] },
                tags: true,
            });
        });

        it('RelationBuilder is exported and usable standalone', () => {
            const rb = new RelationBuilder().add('posts', { joinType: 'inner' });
            expect(rb.toObject()).toEqual({ posts: { joinType: 'inner' } });
        });
    });

    describe('aggregates + having', () => {
        it('serialises aggregates/having as JSON strings by default', () => {
            const params = qb
                .addAggregate({ fn: AggregateFnEnum.COUNT, field: 'posts.id', as: 'postCount' })
                .addAggregate({ fn: AggregateFnEnum.SUM, field: 'posts.likes', as: 'likesSum' })
                .having('postCount', WhereOperatorEnum.GT, 5)
                .addOrder('postCount', OrderDirectionEnum.DESC)
                .toObject();

            expect(JSON.parse(params.aggregates as string)).toEqual([
                { fn: 'count', field: 'posts.id', as: 'postCount' },
                { fn: 'sum', field: 'posts.likes', as: 'likesSum' },
            ]);
            expect(JSON.parse(params.having as string)).toEqual({ postCount: { $gt: 5 } });
            expect(JSON.parse(params.order as string)).toEqual({ postCount: 'DESC' });
        });

        it('keeps aggregates as an array and having as an object in nested mode', () => {
            const params = qb
                .addAggregate({ fn: AggregateFnEnum.AVG, field: 'posts.likes', as: 'avgLikes' })
                .having('avgLikes', WhereOperatorEnum.GT_OR_EQ, 10)
                .toObject(true);

            expect(params.aggregates).toEqual([{ fn: 'avg', field: 'posts.likes', as: 'avgLikes' }]);
            expect(params.having).toEqual({ avgLikes: { $gte: 10 } });
        });

        it('removeAggregate drops one by alias; empty aggregates/having are omitted', () => {
            qb.addAggregate({ fn: AggregateFnEnum.COUNT, field: 'posts.id', as: 'postCount' })
                .addAggregate({ fn: AggregateFnEnum.SUM, field: 'posts.likes', as: 'likesSum' })
                .removeAggregate('likesSum');

            const params = qb.toObject(true);
            expect(params.aggregates).toEqual([{ fn: 'count', field: 'posts.id', as: 'postCount' }]);
            expect(params.having).toBeUndefined();
        });
    });

    describe('new operators reach the wire via the 3-arg form', () => {
        it('$ieq / $exists serialise correctly', () => {
            const where = qb
                .where('name', WhereOperatorEnum.IEQ, 'john')
                .andWhere('posts', WhereOperatorEnum.EXISTS, true)
                .toObject(true).where;
            expect(where).toEqual({ name: { $ieq: 'john' }, $and: [{ posts: { $exists: true } }] });
        });
    });
});
