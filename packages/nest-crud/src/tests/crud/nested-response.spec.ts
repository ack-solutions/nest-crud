import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { createCrudTestApp } from '../helper/testing-module';
import { seedTestData } from '../helper/seed-data';
import { User } from '../helper/entities/user-test.entity';
import { CrudService } from '../../lib/service/crud-service';

/**
 * v2.1 — an explicit `select` must not drop nested relation data or the entity id.
 * The root primary key is force-included so TypeORM can hydrate relations and so the
 * two-phase aggregate path can merge aggregate values back onto each row.
 */
describe('Nested response with explicit select', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let repo: Repository<User>;
    let service: CrudService<User>;

    beforeAll(async () => {
        app = await createCrudTestApp({ entity: User, path: 'users', routes: { findMany: { enabled: true } } });
        dataSource = app.get(DataSource);
        repo = dataSource.getRepository(User);
        service = new CrudService<User>(repo);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        await seedTestData(dataSource, repo);
    });

    afterAll(async () => {
        await app.close();
    });

    it('select:[name] + relations:[profile] still hydrates the relation and keeps the id', async () => {
        const res = await service.findMany({
            select: JSON.stringify(['name']),
            relations: JSON.stringify(['profile']),
            order: JSON.stringify({ name: 'ASC' }),
        } as any);

        expect(res.items).toHaveLength(2);
        const john = res.items.find((u) => u.name === 'John Doe')!;
        expect(john.id).toBeDefined();          // pk force-included
        expect(john.profile).toBeDefined();     // nested relation hydrated
        expect(john.profile.age).toBe(25);
    });

    it('select:[name] + relations + aggregates keeps id, nested profile and the aggregate', async () => {
        const res = await service.findMany({
            select: JSON.stringify(['name']),
            relations: JSON.stringify(['profile']),
            aggregates: JSON.stringify([{ fn: 'count', field: 'posts.id', as: 'postCount' }]),
            order: JSON.stringify({ name: 'ASC' }),
        } as any);

        expect(res.items).toHaveLength(2);
        const john = res.items.find((u) => u.name === 'John Doe') as any;
        expect(john.id).toBeDefined();
        expect(john.name).toBe('John Doe');
        expect(john.profile?.age).toBe(25);
        expect(john.postCount).toBe(2);
    });
});
