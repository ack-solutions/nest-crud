import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';

import { createCrudTestApp } from '../helper/testing-module';
import { User } from '../helper/entities/user-test.entity';
import { OrderedItem } from '../helper/entities/ordered-item-test.entity';
import { CrudService } from '../../lib/service/crud-service';

/**
 * v2 — every mutation response uses the unified `{ success, message }` shape.
 */
describe('v2 unified response shapes', () => {
    let app: INestApplication;
    let dataSource: DataSource;

    beforeAll(async () => {
        app = await createCrudTestApp({
            entity: User,
            path: 'users',
            routes: { create: { enabled: true }, delete: { enabled: true }, deleteMany: { enabled: true } },
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

    it('delete returns { success, message }', async () => {
        const user = (await http().post('/users').send({ name: 'x' }).expect(201)).body;
        const res = await http().delete(`/users/${user.id}`).expect(200);
        expect(res.body).toEqual({ success: true, message: expect.any(String) });
    });

    it('deleteMany returns { success, message }', async () => {
        const a = (await http().post('/users').send({ name: 'a' }).expect(201)).body;
        const b = (await http().post('/users').send({ name: 'b' }).expect(201)).body;
        const res = await http().delete('/users/delete/bulk').query({ ids: [a.id, b.id] }).expect(200);
        expect(res.body).toEqual({ success: true, message: expect.any(String) });
    });

    it('reorder returns { success, message }', async () => {
        const repo = dataSource.getRepository(OrderedItem);
        const item = await repo.save(repo.create({ name: 'a' }));
        const result = await new CrudService(repo).reorder([item.id]);
        expect(result).toEqual({ success: true, message: expect.any(String) });
    });
});
