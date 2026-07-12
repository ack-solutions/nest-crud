import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';

import { createCrudTestingModule } from '../helper/testing-module';
import { User } from '../helper/entities/user-test.entity';

/**
 * The counts endpoint (`GET {resource}/get/counts`) must honour the soft-delete
 * flags like the list endpoints do. The counts request goes through a STRICT
 * ValidationPipe (`whitelist` + `forbidNonWhitelisted` + `transform`) to mirror a
 * real app — exactly the setup under which the bug showed:
 *   - before: top-level `onlyDeleted`/`withDeleted` were rejected `400` by the
 *     counts DTO, and even when they slipped through, `counts()` ignored them
 *     (always the active set).
 *
 * Rows are seeded via the repository so the strict pipe only gates the endpoint
 * under test (the generated create DTO isn't the subject here).
 */
describe('counts endpoint honours soft-delete flags', () => {
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
    const counts = (q: Record<string, any> = {}) => http().get('/users/get/counts').query(q);

    // 2 active + 1 soft-deleted
    async function seed() {
        await repo.save(repo.create([{ name: 'a' }, { name: 'b' }]));
        const c = await repo.save(repo.create({ name: 'c' }));
        await repo.softDelete(c.id);
    }

    it('default: counts only the active set', async () => {
        await seed();
        expect((await counts().expect(200)).body.total).toBe(2);
    });

    it('?onlyDeleted=true: accepted (not 400) and counts only the deleted set', async () => {
        await seed();
        expect((await counts({ onlyDeleted: 'true' }).expect(200)).body.total).toBe(1);
    });

    it('?withDeleted=true: counts the full set (active + deleted)', async () => {
        await seed();
        expect((await counts({ withDeleted: 'true' }).expect(200)).body.total).toBe(3);
    });

    it('groupByKey + onlyDeleted: grouped counts over the deleted set only', async () => {
        await repo.save(repo.create({ name: 'keep' })); // active, excluded
        const gone = await repo.save(repo.create([{ name: 'gone' }, { name: 'gone' }]));
        await repo.softDelete(gone.map((u) => u.id));

        const res = await counts({ onlyDeleted: 'true', groupByKey: 'name' }).expect(200);
        expect(res.body.total).toBe(2);
        expect(res.body.data).toEqual([{ name: 'gone', count: 2 }]);
    });
});
