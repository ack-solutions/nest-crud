import { BadRequestException, INestApplication, NotFoundException } from '@nestjs/common';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';

import { createCrudTestApp } from '../helper/testing-module';
import { User } from '../helper/entities/user-test.entity';
import { OrderedItem } from '../helper/entities/ordered-item-test.entity';
import { CrudService } from '../../lib/service/crud-service';
import { ID } from '../../lib/interface/typeorm';

/**
 * Scopes every mutation to a "tenant" — modelled here by `User.status`. This is the
 * write-side counterpart to a `beforeFindMany` that scopes reads. With it, a row
 * from another tenant is invisible to update/delete/restore (404) and silently
 * skipped by the bulk variants — closing the cross-tenant IDOR on mutations.
 */
class TenantUserService extends CrudService<User> {
    tenant = 'A';
    protected async beforeMutate(criteria: FindOptionsWhere<User>): Promise<FindOptionsWhere<User>> {
        return { ...criteria, status: this.tenant } as FindOptionsWhere<User>;
    }
}

/** Reorders by a non-default column, over a narrowed (owned) id set. */
class ScopedItemService extends CrudService<OrderedItem> {
    protected reorderColumn = 'sortOrder';
    ownedIds: string[] = [];
    protected async beforeReorder(ids: ID[]): Promise<ID[]> {
        return ids.filter((id) => this.ownedIds.includes(id as string));
    }
}

describe('Mutation scoping — beforeMutate / beforeReorder / reorderColumn', () => {
    let app: INestApplication;
    let userRepo: Repository<User>;
    let itemRepo: Repository<OrderedItem>;

    beforeAll(async () => {
        app = await createCrudTestApp({ entity: User, path: 'users' });
        const dataSource = app.get(DataSource);
        userRepo = dataSource.getRepository(User);
        itemRepo = dataSource.getRepository(OrderedItem);
    });

    afterAll(async () => {
        await app.close();
    });

    describe('beforeMutate scopes update / delete / restore / trash + bulk', () => {
        let aId: string; // tenant A
        let bId: string; // tenant B
        let svcA: TenantUserService;

        beforeEach(async () => {
            await userRepo.clear();
            const a = await userRepo.save(userRepo.create({ name: 'A-user', status: 'A' }));
            const b = await userRepo.save(userRepo.create({ name: 'B-user', status: 'B' }));
            aId = a.id;
            bId = b.id;
            svcA = new TenantUserService(userRepo);
        });

        it('update: another tenant\'s id → 404, and the row is untouched', async () => {
            await expect(svcA.update(bId, { name: 'HACKED' })).rejects.toThrow(NotFoundException);
            expect((await userRepo.findOneBy({ id: bId }))!.name).toBe('B-user');
        });

        it('update: own tenant\'s id → succeeds', async () => {
            const res = await svcA.update(aId, { name: 'A-renamed' });
            expect(res.name).toBe('A-renamed');
        });

        it('delete: another tenant\'s id → 404, and the row survives', async () => {
            await expect(svcA.delete(bId)).rejects.toThrow(NotFoundException);
            expect(await userRepo.findOneBy({ id: bId })).toBeTruthy();
        });

        it('delete: own tenant\'s id → removed', async () => {
            await svcA.delete(aId);
            expect(await userRepo.findOneBy({ id: aId })).toBeNull();
        });

        it('deleteMany: bulk affects only own-tenant rows', async () => {
            await svcA.deleteMany({ ids: [aId, bId] });
            expect(await userRepo.findOneBy({ id: aId })).toBeNull();   // own → deleted
            expect(await userRepo.findOneBy({ id: bId })).toBeTruthy(); // other → skipped
        });

        it('restore: another tenant\'s trashed id → 404, stays trashed', async () => {
            await userRepo.softDelete(aId);
            await userRepo.softDelete(bId);
            await expect(svcA.restore(bId)).rejects.toThrow(NotFoundException);
            expect((await userRepo.findOne({ where: { id: bId }, withDeleted: true }))!.deletedAt).toBeTruthy();
        });

        it('restore: own tenant\'s trashed id → restored', async () => {
            await userRepo.softDelete(aId);
            await svcA.restore(aId);
            expect((await userRepo.findOneBy({ id: aId }))).toBeTruthy();
        });

        it('deleteFromTrash: another tenant\'s trashed id → 404, stays in trash', async () => {
            await userRepo.softDelete(aId);
            await userRepo.softDelete(bId);
            await expect(svcA.deleteFromTrash(bId)).rejects.toThrow(NotFoundException);
            expect(await userRepo.findOne({ where: { id: bId }, withDeleted: true })).toBeTruthy();
        });
    });

    describe('backward compatible: default service is unscoped (no behaviour change)', () => {
        let aId: string;
        let bId: string;
        let plain: CrudService<User>;

        beforeEach(async () => {
            await userRepo.clear();
            const a = await userRepo.save(userRepo.create({ name: 'A-user', status: 'A' }));
            const b = await userRepo.save(userRepo.create({ name: 'B-user', status: 'B' }));
            aId = a.id;
            bId = b.id;
            plain = new CrudService<User>(userRepo);
        });

        it('a plain CrudService updates/deletes any id (default beforeMutate is a no-op)', async () => {
            const res = await plain.update(bId, { name: 'edited' });
            expect(res.name).toBe('edited');
            await plain.delete(aId);
            expect(await userRepo.findOneBy({ id: aId })).toBeNull();
        });
    });

    describe('reorder — configurable column, before-hook, and validation', () => {
        let ids: string[];

        beforeEach(async () => {
            await itemRepo.clear();
            ids = [];
            for (const name of ['x', 'y', 'z']) {
                // Sentinels (88 / 99) so "untouched" is distinguishable from a written 0..2.
                const row = await itemRepo.save(itemRepo.create({ name, order: 88, sortOrder: 99 }));
                ids.push(row.id);
            }
        });

        it('throws 400 when the reorder column does not exist on the entity', async () => {
            // User has no `order` column → the default reorderColumn is invalid here.
            await expect(new CrudService<User>(userRepo).reorder([ids[0]])).rejects.toThrow(BadRequestException);
        });

        it('default reorderColumn writes `order` (and leaves other columns alone)', async () => {
            await new CrudService<OrderedItem>(itemRepo).reorder([ids[2], ids[0], ids[1]]);
            const rows = await itemRepo.find();
            const byId = new Map(rows.map((r) => [r.id, r]));
            expect(byId.get(ids[2])!.order).toBe(0);
            expect(byId.get(ids[0])!.order).toBe(1);
            expect(byId.get(ids[1])!.order).toBe(2);
            expect(byId.get(ids[0])!.sortOrder).toBe(99); // untouched
        });

        it('a custom reorderColumn writes that column instead', async () => {
            const svc = new ScopedItemService(itemRepo);
            svc.ownedIds = ids; // own everything for this case
            await svc.reorder([ids[2], ids[0], ids[1]]);
            const byId = new Map((await itemRepo.find()).map((r) => [r.id, r]));
            expect(byId.get(ids[2])!.sortOrder).toBe(0);
            expect(byId.get(ids[0])!.sortOrder).toBe(1);
            expect(byId.get(ids[1])!.sortOrder).toBe(2);
            expect(byId.get(ids[2])!.order).toBe(88); // `order` untouched
        });

        it('beforeReorder narrows the set so non-owned ids are never written', async () => {
            const svc = new ScopedItemService(itemRepo);
            svc.ownedIds = [ids[0], ids[2]]; // ids[1] is NOT owned
            await svc.reorder([ids[0], ids[1], ids[2]]);
            const byId = new Map((await itemRepo.find()).map((r) => [r.id, r]));
            expect(byId.get(ids[0])!.sortOrder).toBe(0);
            expect(byId.get(ids[2])!.sortOrder).toBe(1);
            expect(byId.get(ids[1])!.sortOrder).toBe(99); // untouched — not owned
        });
    });
});
