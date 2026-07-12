import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';

import { createCrudTestingModule } from '../helper/testing-module';
import { User } from '../helper/entities/user-test.entity';

/**
 * The counts endpoint (`GET {resource}/get/counts`) takes a `filter` that is the
 * same shape as a findMany query (the request query builder's output): `where`,
 * `relations`, `order`, and the soft-delete flags `withDeleted` / `onlyDeleted`.
 * Everything in `filter` must be honoured — no separate root query params.
 *
 * Before the fix, `counts()` ran a JSON-string `filter` through `qs` instead of
 * `JSON.parse`, so the ENTIRE filter was dropped: `where` was ignored AND the
 * soft-delete flags were ignored (counts always returned the active set).
 *
 * Uses a STRICT ValidationPipe (`whitelist` + `forbidNonWhitelisted` + `transform`)
 * to mirror a real app, and seeds via the repository so the pipe only gates the
 * endpoint under test. `filter` is sent as a JSON string, exactly as the client
 * query builder's `toJson()` serialises it.
 */
describe('counts endpoint honours the filter (nested where + soft-delete)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let repo: Repository<User>;

    beforeAll(async () => {
        const moduleRef = await createCrudTestingModule({
            entity: User,
            path: 'users',
            softDelete: true,
            routes: { counts: { enabled: true } },
        });
        app = moduleRef.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        await app.init();
        dataSource = app.get(DataSource);
        repo = dataSource.getRepository(User);
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const http = () => request(app.getHttpServer());
    // `filter` sent as a JSON string, like the query builder's toJson() output.
    const counts = (filter?: Record<string, any>, extra: Record<string, any> = {}) =>
        http().get('/users/get/counts').query({
            ...(filter !== undefined ? { filter: JSON.stringify(filter) } : {}),
            ...extra,
        });

    // 2 active (a, b) + 1 soft-deleted (c)
    async function seed() {
        await repo.save(repo.create([{ name: 'a' }, { name: 'b' }]));
        const c = await repo.save(repo.create({ name: 'c' }));
        await repo.softDelete(c.id);
    }

    it('no filter: counts only the active set', async () => {
        await seed();
        expect((await counts().expect(200)).body.total).toBe(2);
    });

    it('filter { onlyDeleted: true }: counts only the deleted set', async () => {
        await seed();
        expect((await counts({ onlyDeleted: true }).expect(200)).body.total).toBe(1);
    });

    it('filter { withDeleted: true }: counts the full set (active + deleted)', async () => {
        await seed();
        expect((await counts({ withDeleted: true }).expect(200)).body.total).toBe(3);
    });

    it('filter { where }: counts only matching rows (where was dropped before too)', async () => {
        await seed();
        expect((await counts({ where: { name: 'a' } }).expect(200)).body.total).toBe(1);
    });

    it('filter { where + onlyDeleted }: both apply together', async () => {
        await repo.save(repo.create({ name: 'gone' })); // active, wrong deleted-state
        const gone = await repo.save(repo.create([{ name: 'gone' }, { name: 'gone' }]));
        await repo.softDelete(gone.map((u) => u.id));
        // deleted rows named 'gone' → 2 (the active 'gone' is excluded by onlyDeleted)
        expect((await counts({ onlyDeleted: true, where: { name: 'gone' } }).expect(200)).body.total).toBe(2);
    });

    it('groupByKey + filter { onlyDeleted }: grouped over the deleted set only', async () => {
        await repo.save(repo.create({ name: 'keep' })); // active, excluded
        const gone = await repo.save(repo.create([{ name: 'gone' }, { name: 'gone' }]));
        await repo.softDelete(gone.map((u) => u.id));
        const res = await counts({ onlyDeleted: true }, { groupByKey: 'name' }).expect(200);
        expect(res.body.total).toBe(2);
        expect(res.body.data).toEqual([{ name: 'gone', count: 2 }]);
    });

    it('malformed filter JSON → 400', async () => {
        await http().get('/users/get/counts').query({ filter: '{not json' }).expect(400);
    });
});
