import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';

import { createCrudTestApp } from '../helper/testing-module';
import { User } from '../helper/entities/user-test.entity';

describe('Soft-delete routes', () => {
    let app: INestApplication;
    let dataSource: DataSource;

    beforeAll(async () => {
        app = await createCrudTestApp({
            entity: User,
            path: 'users',
            softDelete: true,
            routes: {
                findMany: { enabled: true },
                findOne: { enabled: true },
                create: { enabled: true },
                delete: { enabled: true },
                deleteMany: { enabled: true },
                restore: { enabled: true },
                restoreMany: { enabled: true },
                deleteFromTrash: { enabled: true },
                deleteFromTrashMany: { enabled: true },
            },
        });
        dataSource = app.get(DataSource);
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const http = () => request(app.getHttpServer());
    const createUser = async (name = 'U') => (await http().post('/users').send({ name }).expect(201)).body;

    it('DELETE /:id soft-deletes (hidden from lists, still recoverable)', async () => {
        const user = await createUser();
        await http().delete(`/users/${user.id}`).expect(200);

        await http().get(`/users/${user.id}`).expect(404);
        expect((await http().get('/users').expect(200)).body.total).toBe(0);
        expect((await http().get('/users').query({ withDeleted: 'true' }).expect(200)).body.total).toBe(1);
    });

    it('GET ?onlyDeleted=true returns only trashed records', async () => {
        await createUser('live');
        const trashed = await createUser('trashed');
        await http().delete(`/users/${trashed.id}`).expect(200);

        const res = await http().get('/users').query({ onlyDeleted: 'true' }).expect(200);
        expect(res.body.total).toBe(1);
        expect(res.body.items[0].id).toBe(trashed.id);
    });

    it('PUT /:id/restore brings a trashed record back', async () => {
        const user = await createUser();
        await http().delete(`/users/${user.id}`).expect(200);
        await http().put(`/users/${user.id}/restore`).expect(200);
        await http().get(`/users/${user.id}`).expect(200);
    });

    it('DELETE /:id/trash permanently removes a trashed record', async () => {
        const user = await createUser();
        await http().delete(`/users/${user.id}`).expect(200);
        await http().delete(`/users/${user.id}/trash`).expect(200);
        expect((await http().get('/users').query({ withDeleted: 'true' }).expect(200)).body.total).toBe(0);
    });

    it('bulk soft-delete then bulk restore', async () => {
        const a = await createUser('a');
        const b = await createUser('b');

        await http().delete('/users/delete/bulk').query({ ids: [a.id, b.id] }).expect(200);
        expect((await http().get('/users').expect(200)).body.total).toBe(0);

        await http().put('/users/restore/bulk').send({ ids: [a.id, b.id] }).expect(200);
        expect((await http().get('/users').expect(200)).body.total).toBe(2);
    });
});
