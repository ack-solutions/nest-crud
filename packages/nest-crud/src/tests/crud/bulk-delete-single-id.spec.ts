import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';

import { createCrudTestApp } from '../helper/testing-module';
import { User } from '../helper/entities/user-test.entity';

/**
 * Bulk delete reads `ids` from the query. Over HTTP a one-element array serialises
 * to a scalar (`?ids=x`) — Express only builds an array from repeated keys
 * (`?ids=a&ids=b`) — so deleting exactly one row via the bulk route used to fail
 * `@IsArray()` with 400. The DTO now coerces a scalar to a one-element array (and
 * the service normalises defensively), so a single id works like multiple.
 */
describe('bulk delete accepts a single id (scalar query param)', () => {
    let app: INestApplication;
    let dataSource: DataSource;

    beforeAll(async () => {
        app = await createCrudTestApp({
            entity: User,
            path: 'users',
            softDelete: true,
            routes: {
                create: { enabled: true },
                findOne: { enabled: true },
                deleteMany: { enabled: true },
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

    it('DELETE /delete/bulk?ids=<one> deletes the single row (previously 400)', async () => {
        const u = await createUser();
        await http().delete('/users/delete/bulk').query({ ids: u.id }).expect(200);
        await http().get(`/users/${u.id}`).expect(404); // soft-deleted → hidden
    });

    it('DELETE /delete/bulk with two ids still deletes both', async () => {
        const a = await createUser('a');
        const b = await createUser('b');
        await http().delete('/users/delete/bulk').query({ ids: [a.id, b.id] }).expect(200);
        await http().get(`/users/${a.id}`).expect(404);
        await http().get(`/users/${b.id}`).expect(404);
    });

    it('DELETE /delete/bulk with no ids is a no-op (200)', async () => {
        await http().delete('/users/delete/bulk').expect(200);
    });

    it('DELETE /trash/bulk?ids=<one> permanently deletes a single trashed row', async () => {
        const u = await createUser();
        await http().delete('/users/delete/bulk').query({ ids: u.id }).expect(200);          // soft-delete
        await http().delete('/users/trash/bulk').query({ ids: u.id }).expect(200);           // purge one
        await http().get(`/users/${u.id}`).query({ withDeleted: 'true' }).expect(404);       // truly gone
    });
});
