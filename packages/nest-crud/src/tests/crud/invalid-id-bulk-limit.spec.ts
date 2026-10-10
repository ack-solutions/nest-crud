import { INestApplication, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';

import { createCrudTestApp } from '../helper/testing-module';
import { User } from '../helper/entities/user-test.entity';
import { CrudService } from '../../lib/service/crud-service';
import { CrudConfigService } from '../../lib/service/crud-config.service';

/**
 * A malformed id (not UUID-shaped, for a UUID primary key) can never match a row.
 * On a database with a real `uuid` type it raised an error (500, and it failed a
 * whole bulk request); it is now treated as "not found".
 */
describe('ids that cannot match a row', () => {
    let app: INestApplication;
    let users: Repository<User>;
    let svc: CrudService<User>;
    let a: User;

    beforeAll(async () => {
        app = await createCrudTestApp({ entity: User, path: 'users', softDelete: true });
        users = app.get(DataSource).getRepository(User);
        svc = new CrudService<User>(users);
    });
    afterAll(async () => { await app.close(); });
    beforeEach(async () => {
        await app.get(DataSource).synchronize(true);
        a = await users.save(users.create({ name: 'A' }));
    });

    it('single-row calls → NotFound', async () => {
        await expect(svc.findOne('abc')).rejects.toThrow(NotFoundException);
        await expect(svc.update('abc', { name: 'x' })).rejects.toThrow(NotFoundException);
        await expect(svc.delete('abc')).rejects.toThrow(NotFoundException);
        await expect(svc.restore('abc')).rejects.toThrow(NotFoundException);
        await expect(svc.deleteFromTrash('abc')).rejects.toThrow(NotFoundException);
    });

    it('updateMany skips it and still updates the valid rows', async () => {
        const out = await svc.updateMany({ bulk: [{ id: 'abc', name: 'x' }, { id: a.id, name: 'A2' }] as any });
        expect(out.map((u) => u.id)).toEqual([a.id]); // the reply lists only what was updated
        expect((await users.findOneBy({ id: a.id }))!.name).toBe('A2');
    });

    it('deleteMany / restoreMany ignore it', async () => {
        await svc.deleteMany({ ids: ['abc', a.id] }, true);
        expect(await users.findOneBy({ id: a.id })).toBeNull();
        await svc.restoreMany({ ids: ['abc', a.id] });
        expect(await users.findOneBy({ id: a.id })).toBeTruthy();
    });

    it('over HTTP: GET /users/abc is 404', async () => {
        await request(app.getHttpServer()).get('/users/abc').expect(404);
    });
});

describe('maxBulkSize', () => {
    let app: INestApplication;
    const http = () => request(app.getHttpServer());
    const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `u${i}` }));

    beforeAll(async () => {
        app = await createCrudTestApp({ entity: User, path: 'users', softDelete: true, maxBulkSize: 2 });
    });
    afterAll(async () => { await app.close(); });

    it('accepts a bulk request at the limit', async () => {
        await http().post('/users/bulk').send({ bulk: rows(2) }).expect(201);
    });

    it('rejects a larger one with 400 on every bulk route', async () => {
        const res = await http().post('/users/bulk').send({ bulk: rows(3) }).expect(400);
        expect(res.body.message).toContain('maxBulkSize (2)');
        const ids = ['1', '2', '3'];
        await http().put('/users/bulk').send({ bulk: ids.map((id) => ({ id, name: 'x' })) }).expect(400);
        await http().delete('/users/delete/bulk').query({ ids }).expect(400);
        await http().delete('/users/trash/bulk').query({ ids }).expect(400);
        await http().put('/users/restore/bulk').send({ ids }).expect(400);
    });

    it('falls back to the global setting, and is unlimited when unset', async () => {
        const original = CrudConfigService.config;
        const open = await createCrudTestApp({ entity: User, path: 'users' });
        await request(open.getHttpServer()).post('/users/bulk').send({ bulk: rows(5) }).expect(201);
        CrudConfigService.load({ maxBulkSize: 1 });
        await request(open.getHttpServer()).post('/users/bulk').send({ bulk: rows(2) }).expect(400);
        CrudConfigService.config = original;
        await open.close();
    });
});
