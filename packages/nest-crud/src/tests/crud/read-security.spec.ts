import { INestApplication, NotFoundException } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

import { createCrudTestApp } from '../helper/testing-module';
import { seedTestData } from '../helper/seed-data';
import { User } from '../helper/entities/user-test.entity';
import { CrudService } from '../../lib/service/crud-service';

/** Scopes reads to active users — the kind of tenant/visibility guard apps put in beforeFindMany. */
class ActiveScopedService extends CrudService<User> {
    protected async beforeFindMany(qb: SelectQueryBuilder<User>) {
        return qb.andWhere(`${qb.alias}.status = :s`, { s: 'active' });
    }
}

/** Refuses the client's soft-delete query flags. */
class NoTrashService extends CrudService<User> {
    protected async allowSoftDeleteFilter() {
        return false;
    }
}

const AGG = { aggregates: [{ fn: 'count' as const, field: 'posts.id', as: 'postCount' }] };

describe('Read-path security hooks', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let repo: Repository<User>;

    beforeAll(async () => {
        app = await createCrudTestApp({ entity: User, path: 'users', routes: { findMany: { enabled: true } } });
        dataSource = app.get(DataSource);
        repo = dataSource.getRepository(User);
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        await seedTestData(dataSource, repo); // John Doe (active, 2 posts), Jane Smith (inactive, 1 post)
    });

    describe('the aggregate path applies beforeFindMany (was bypassed)', () => {
        it('control: an unscoped service returns both users on the aggregate path', async () => {
            const { total } = await new CrudService<User>(repo).findMany({ ...AGG });
            expect(total).toBe(2);
        });

        it('findMany: an aggregate request is scoped by beforeFindMany', async () => {
            const { items, total } = await new ActiveScopedService(repo).findMany({ ...AGG });
            expect(total).toBe(1); // Jane (inactive) is excluded, not leaked via the aggregate branch
            expect(items).toHaveLength(1);
            expect(items[0].name).toBe('John Doe');
            expect((items[0] as any).postCount).toBe(2); // aggregate still correct
        });

        it('findAll: the aggregate path is scoped too', async () => {
            const items = await new ActiveScopedService(repo).findAll({ ...AGG });
            expect(items.map((u) => u.name)).toEqual(['John Doe']);
        });
    });

    describe('allowSoftDeleteFilter gates the soft-delete flags', () => {
        let janeId: string;
        beforeEach(async () => {
            const jane = await repo.findOne({ where: { name: 'Jane Smith' } });
            janeId = jane!.id;
            await repo.softDelete(janeId); // trash Jane
        });

        it('control: an unscoped service honours ?withDeleted=true (sees the trashed row)', async () => {
            const { total } = await new CrudService<User>(repo).findMany({ withDeleted: true });
            expect(total).toBe(2);
        });

        it('denied: withDeleted is forced off — only live rows', async () => {
            const { items, total } = await new NoTrashService(repo).findMany({ withDeleted: true });
            expect(total).toBe(1);
            expect(items[0].name).toBe('John Doe');
        });

        it('denied: onlyDeleted is forced off too — the live set, not the trash', async () => {
            const { items } = await new NoTrashService(repo).findMany({ onlyDeleted: true });
            expect(items.map((u) => u.name)).toEqual(['John Doe']);
        });

        it('denied: counts also ignores the client soft-delete flag', async () => {
            const { total } = await new NoTrashService(repo).counts({ filter: { withDeleted: true } });
            expect(total).toBe(1); // only the live row is counted
        });

        it('control: an unscoped findOne honours ?withDeleted=true (fetches the trashed row)', async () => {
            const found = await new CrudService<User>(repo).findOne(janeId, { withDeleted: true } as any);
            expect(found.name).toBe('Jane Smith');
        });

        it('denied: findOne is gated too — a trashed row is not fetchable via withDeleted', async () => {
            await expect(
                new NoTrashService(repo).findOne(janeId, { withDeleted: true } as any),
            ).rejects.toThrow(NotFoundException);
        });
    });
});
