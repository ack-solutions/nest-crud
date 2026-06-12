import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { createCrudTestApp } from '../helper/testing-module';
import { seedTestData } from '../helper/seed-data';
import { User } from '../helper/entities/user-test.entity';
import { AggregateQueryBuilder } from '../../lib/helper/aggregate-query-builder';
import { CrudService } from '../../lib/service/crud-service';
import { OrderDirectionEnum } from '../../lib/types';

/**
 * v2.1 advanced querying — per-row aggregates over a relation (count/sum/avg/min/max),
 * filtered (HAVING) and sorted on the aggregate alias via the two-phase derived table.
 *
 * Seed (John, Jane):
 *  - John Doe: 2 posts (likes 10, 5)         → count 2, sum 15, avg 7.5, min 5,  max 10
 *  - Jane Smith: 1 post (likes 20, 2 comments) → count 1, sum 20, avg 20,  min 20, max 20
 */
describe('Aggregates (count/sum/avg/min/max) — two-phase derived table', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let repo: Repository<User>;

    const agg = () => new AggregateQueryBuilder<User>(repo);

    beforeAll(async () => {
        app = await createCrudTestApp({ entity: User, path: 'users', routes: { findMany: { enabled: true } } });
        dataSource = app.get(DataSource);
        repo = dataSource.getRepository(User);
    });

    // Fresh schema per test for isolation, then seed.
    beforeEach(async () => {
        await dataSource.synchronize(true);
        await seedTestData(dataSource, repo);
    });

    afterAll(async () => {
        await app.close();
    });

    it('COUNT over a relation, attached per row and ordered by the alias (DESC)', async () => {
        const { items, total } = await agg().getManyAndCount({
            aggregates: [{ fn: 'count', field: 'posts.id', as: 'postCount' }],
            order: { postCount: OrderDirectionEnum.DESC },
        });

        expect(total).toBe(2);
        expect(items.map((u) => (u as any).postCount)).toEqual([2, 1]);
        expect(items[0].name).toBe('John Doe');
        expect(items[1].name).toBe('Jane Smith');
    });

    it('SUM / AVG / MIN / MAX over a relation column', async () => {
        const { items } = await agg().getManyAndCount({
            aggregates: [
                { fn: 'sum', field: 'posts.likes', as: 'likesSum' },
                { fn: 'avg', field: 'posts.likes', as: 'likesAvg' },
                { fn: 'min', field: 'posts.likes', as: 'likesMin' },
                { fn: 'max', field: 'posts.likes', as: 'likesMax' },
            ],
            order: { name: OrderDirectionEnum.ASC },
        });

        const jane = items.find((u) => u.name === 'Jane Smith') as any;
        const john = items.find((u) => u.name === 'John Doe') as any;

        expect(john.likesSum).toBe(15);
        expect(john.likesAvg).toBeCloseTo(7.5, 5);
        expect(john.likesMin).toBe(5);
        expect(john.likesMax).toBe(10);

        expect(jane.likesSum).toBe(20);
        expect(jane.likesAvg).toBeCloseTo(20, 5);
        expect(jane.likesMin).toBe(20);
        expect(jane.likesMax).toBe(20);
    });

    it('empty relation set → count/sum = 0, avg/min/max = null', async () => {
        await repo.save(repo.create({ name: 'No Posts', email: 'noposts@example.com', status: 'active' }));

        const { items, total } = await agg().getManyAndCount({
            aggregates: [
                { fn: 'count', field: 'posts.id', as: 'postCount' },
                { fn: 'sum', field: 'posts.likes', as: 'likesSum' },
                { fn: 'avg', field: 'posts.likes', as: 'likesAvg' },
                { fn: 'min', field: 'posts.likes', as: 'likesMin' },
                { fn: 'max', field: 'posts.likes', as: 'likesMax' },
            ],
            where: { name: 'No Posts' },
        });

        expect(total).toBe(1);
        const u = items[0] as any;
        expect(u.postCount).toBe(0);
        expect(u.likesSum).toBe(0);
        expect(u.likesAvg).toBeNull();
        expect(u.likesMin).toBeNull();
        expect(u.likesMax).toBeNull();
    });

    it('does NOT inflate a SUM when a fanned-out relation is also joined (row-multiplication guard)', async () => {
        // Jane's single post has 2 comments. A naive JOIN posts+comments would double the
        // post row and report sum(likes) = 40; the correlated subquery must report 20.
        const { items } = await agg().getManyAndCount({
            aggregates: [{ fn: 'sum', field: 'posts.likes', as: 'likesSum' }],
            relations: ['posts', 'posts.comments'],
            where: { name: 'Jane Smith' },
        });

        expect(items).toHaveLength(1);
        expect((items[0] as any).likesSum).toBe(20);
        // entity hydrated with the relations too
        expect(Array.isArray(items[0].posts)).toBe(true);
    });

    it('HAVING filters on the aggregate alias and keeps an accurate total', async () => {
        const { items, total } = await agg().getManyAndCount({
            aggregates: [{ fn: 'count', field: 'posts.id', as: 'postCount' }],
            having: { postCount: { $gt: 1 } },
        });

        expect(total).toBe(1);
        expect(items).toHaveLength(1);
        expect(items[0].name).toBe('John Doe');
    });

    it('HAVING total is independent of pagination (take)', async () => {
        const { items, total } = await agg().getManyAndCount({
            aggregates: [{ fn: 'count', field: 'posts.id', as: 'postCount' }],
            having: { postCount: { $gte: 1 } },
            order: { postCount: OrderDirectionEnum.DESC },
            take: 1,
        });

        expect(total).toBe(2);
        expect(items).toHaveLength(1);
        expect(items[0].name).toBe('John Doe');
    });

    it('orders by a root column alongside an aggregate selection', async () => {
        const { items } = await agg().getManyAndCount({
            aggregates: [{ fn: 'count', field: 'posts.id', as: 'postCount' }],
            order: { name: OrderDirectionEnum.ASC },
        });

        expect(items.map((u) => u.name)).toEqual(['Jane Smith', 'John Doe']);
        expect(items.map((u) => (u as any).postCount)).toEqual([1, 2]);
    });

    it('rejects an unknown order key, an invalid aggregate field, and an alias collision', async () => {
        await expect(
            agg().getManyAndCount({
                aggregates: [{ fn: 'count', field: 'posts.id', as: 'postCount' }],
                order: { notARealColumn: OrderDirectionEnum.ASC },
            }),
        ).rejects.toThrow();

        await expect(
            agg().getManyAndCount({
                aggregates: [{ fn: 'count', field: 'name', as: 'bad' }], // not relation-qualified
            }),
        ).rejects.toThrow();

        await expect(
            agg().getManyAndCount({
                aggregates: [{ fn: 'count', field: 'posts.id', as: 'name' }], // collides with a column
            }),
        ).rejects.toThrow();
    });

    it('works through CrudService.findMany with HTTP-style JSON params', async () => {
        const service = new CrudService<User>(repo);
        const result = await service.findMany({
            aggregates: JSON.stringify([{ fn: 'count', field: 'posts.id', as: 'postCount' }]),
            having: JSON.stringify({ postCount: { $gte: 1 } }),
            order: JSON.stringify({ postCount: 'DESC' }),
        } as any);

        expect(result.total).toBe(2);
        expect(result.items.map((u) => (u as any).postCount)).toEqual([2, 1]);
    });

    // John: 2 posts (published likes 10, draft likes 5). Jane: 1 post (published likes 20).
    it('per-aggregate where filters the related rows (same operators as where)', async () => {
        const { items } = await agg().getManyAndCount({
            aggregates: [
                { fn: 'count', field: 'posts.id', as: 'allPosts' },
                { fn: 'count', field: 'posts.id', as: 'publishedPosts', where: { status: 'published' } },
                { fn: 'sum', field: 'posts.likes', as: 'publishedLikes', where: { status: 'published' } },
                { fn: 'count', field: 'posts.id', as: 'popularPosts', where: { likes: { $gt: 6 } } },
                { fn: 'count', field: 'posts.id', as: 'draftPosts', where: { status: 'draft' } },
            ],
            order: { name: OrderDirectionEnum.ASC },
        });

        const john = items.find((u) => u.name === 'John Doe') as any;
        const jane = items.find((u) => u.name === 'Jane Smith') as any;

        expect([john.allPosts, john.publishedPosts, john.publishedLikes, john.popularPosts, john.draftPosts]).toEqual([2, 1, 10, 1, 1]);
        expect([jane.allPosts, jane.publishedPosts, jane.publishedLikes, jane.popularPosts, jane.draftPosts]).toEqual([1, 1, 20, 1, 0]);
    });

    it('a filtered aggregate works with HAVING, and an unknown aggregate-where field is rejected', async () => {
        const { total } = await agg().getManyAndCount({
            aggregates: [{ fn: 'count', field: 'posts.id', as: 'published', where: { status: 'published' } }],
            having: { published: { $gte: 1 } },
        });
        expect(total).toBe(2); // both John and Jane have a published post

        await expect(
            agg().getManyAndCount({
                aggregates: [{ fn: 'count', field: 'posts.id', as: 'x', where: { notAColumn: 'y' } }],
            }),
        ).rejects.toThrow();
    });

    it('the aggregate where survives HTTP-style JSON params', async () => {
        const service = new CrudService<User>(repo);
        const result = await service.findMany({
            aggregates: JSON.stringify([{ fn: 'count', field: 'posts.id', as: 'published', where: { status: 'published' } }]),
            order: JSON.stringify({ name: 'ASC' }),
        } as any);

        const john = result.items.find((u) => u.name === 'John Doe') as any;
        expect(john.published).toBe(1); // 1 of John's 2 posts is published
    });
});
