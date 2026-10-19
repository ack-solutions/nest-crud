import { BadRequestException, INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { createCrudTestApp } from '../helper/testing-module';
import { seedTestData } from '../helper/seed-data';
import { User } from '../helper/entities/user-test.entity';
import { Post } from '../helper/entities/post-test.entity';
import { CrudService } from '../../lib/service/crud-service';
import { AggregateQueryBuilder } from '../../lib/helper/aggregate-query-builder';

/**
 * Seed: John Doe — posts "published" (likes 10) and "draft" (likes 5);
 *       Jane Smith — one "published" post (likes 20).
 */
describe('counts: sum columns per group', () => {
    let app: INestApplication;
    let ds: DataSource;
    let posts: CrudService<Post>;

    beforeAll(async () => {
        app = await createCrudTestApp({ entity: User, path: 'users' });
        ds = app.get(DataSource);
    });
    afterAll(async () => { await app.close(); });
    beforeEach(async () => {
        await ds.synchronize(true);
        await seedTestData(ds, ds.getRepository(User));
        posts = new CrudService<Post>(ds.getRepository(Post));
    });

    it('adds a sum per group and overall sums', async () => {
        const res = await posts.counts({ filter: {}, groupByKey: 'status', sum: 'likes' });
        const byStatus = Object.fromEntries(res.data!.map((r) => [r.status, r]));
        expect(byStatus.published).toEqual({ status: 'published', count: 2, likes: 30 });
        expect(byStatus.draft).toEqual({ status: 'draft', count: 1, likes: 5 });
        expect(res.total).toBe(3);
        expect(res.sum).toEqual({ likes: 35 });
    });

    it('works without groupByKey and honours the filter', async () => {
        const res = await posts.counts({ filter: { where: JSON.stringify({ status: 'published' }) } as any, sum: ['likes'] });
        expect(res).toEqual({ total: 2, sum: { likes: 30 } });
    });

    it('sums to 0 when nothing matches', async () => {
        const res = await posts.counts({ filter: { where: JSON.stringify({ status: 'archived' }) } as any, sum: 'likes' });
        expect(res).toEqual({ total: 0, sum: { likes: 0 } });
    });

    it('rejects a non-numeric or unknown column', async () => {
        await expect(posts.counts({ filter: {}, sum: 'title' })).rejects.toThrow(BadRequestException);
        await expect(posts.counts({ filter: {}, sum: 'nope' })).rejects.toThrow(BadRequestException);
    });

    it('leaves counts unchanged when sum is not requested', async () => {
        const res = await posts.counts({ filter: {}, groupByKey: 'status' });
        expect(res.sum).toBeUndefined();
        expect(res.data!.every((r) => Object.keys(r).sort().join() === 'count,status')).toBe(true);
    });
});

describe('related rows that are soft-deleted are skipped', () => {
    let app: INestApplication;
    let ds: DataSource;
    let users: Repository<User>;
    let janeId: string;

    beforeAll(async () => {
        app = await createCrudTestApp({ entity: User, path: 'users' });
        ds = app.get(DataSource);
        users = ds.getRepository(User);
    });
    afterAll(async () => { await app.close(); });
    beforeEach(async () => {
        await ds.synchronize(true);
        await seedTestData(ds, users);
        const jane = await users.findOne({ where: { name: 'Jane Smith' }, relations: ['posts'] });
        janeId = jane!.id;
        await ds.getRepository(Post).softDelete(jane!.posts.map((p) => p.id)); // Jane's only post
    });

    it('$exists no longer counts a soft-deleted related row', async () => {
        const { items } = await new CrudService<User>(users).findMany({ where: JSON.stringify({ posts: { $exists: true } }) } as any);
        expect(items.map((u) => u.name)).toEqual(['John Doe']);
    });

    it('$notExists matches a row whose related rows are all soft-deleted', async () => {
        const { items } = await new CrudService<User>(users).findMany({ where: JSON.stringify({ posts: { $notExists: true } }) } as any);
        expect(items.map((u) => u.id)).toEqual([janeId]);
    });

    it('aggregates skip soft-deleted related rows', async () => {
        const { items } = await new AggregateQueryBuilder<User>(users).getManyAndCount({
            aggregates: [{ fn: 'count', field: 'posts.id', as: 'postCount' }],
        });
        const byName = Object.fromEntries(items.map((u) => [u.name, (u as any).postCount]));
        expect(byName).toEqual({ 'John Doe': 2, 'Jane Smith': 0 });
    });
});
