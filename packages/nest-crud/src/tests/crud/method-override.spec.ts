import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';

import { createCrudTestingModule } from '../helper/testing-module';
import { seedTestData } from '../helper/seed-data';
import { User } from '../helper/entities/user-test.entity';
import { crudMethodOverride } from '../../lib/middleware/method-override.middleware';
import { CrudMethodOverrideModule } from '../../lib/middleware/method-override.module';

/**
 * Method-override: a read whose filter is too long for the URL can be sent as a
 * POST carrying the query in the body, with `X-HTTP-Method-Override: GET` (or a
 * `_method: GET` body field). The middleware turns it back into a GET so the same
 * handler + RequestQueryParser produce an identical result.
 */
describe('crudMethodOverride (unit)', () => {
    const run = (req: any) => {
        const mw = crudMethodOverride();
        let called = false;
        mw(req, {}, () => { called = true; });
        return called;
    };

    it('header override → rewrites POST to GET and merges the body into the query', () => {
        const req = {
            method: 'POST',
            headers: { 'x-http-method-override': 'GET' },
            body: { where: '{"status":{"$eq":"active"}}', take: 20 },
            query: {},
        };
        expect(run(req)).toBe(true);
        expect(req.method).toBe('GET');
        expect(req.query).toEqual({ where: '{"status":{"$eq":"active"}}', take: 20 });
    });

    it('body override (_method) → works and is stripped before becoming the query', () => {
        const req = {
            method: 'POST',
            headers: {},
            body: { where: '{"a":1}', _method: 'GET' },
            query: {},
        };
        expect(run(req)).toBe(true);
        expect(req.method).toBe('GET');
        expect(req.query).toEqual({ where: '{"a":1}' }); // _method removed
        expect(req.body._method).toBeUndefined();
    });

    it('header wins over body, and existing query params are preserved', () => {
        const req = {
            method: 'POST',
            headers: { 'x-http-method-override': 'GET' },
            body: { where: '{"a":1}' },
            query: { take: '10' },
        };
        run(req);
        expect(req.query).toEqual({ take: '10', where: '{"a":1}' });
    });

    it('a POST without any marker is left untouched', () => {
        const req = { method: 'POST', headers: {}, body: { name: 'x' }, query: {} };
        run(req);
        expect(req.method).toBe('POST');
        expect(req.query).toEqual({});
    });

    it('refuses to override to an unsafe verb (only GET is allowed)', () => {
        const req = { method: 'POST', headers: { 'x-http-method-override': 'DELETE' }, body: {}, query: {} };
        run(req);
        expect(req.method).toBe('POST');
    });

    it('leaves non-POST requests alone', () => {
        const req = { method: 'GET', headers: { 'x-http-method-override': 'GET' }, body: {}, query: { a: '1' } };
        run(req);
        expect(req.method).toBe('GET');
        expect(req.query).toEqual({ a: '1' });
    });
});

describe('Method override over HTTP (POST-as-GET, identical to a direct GET)', () => {
    let app: INestApplication;

    // Same shape the client's QueryBuilder.toObject() emits: where/order as JSON strings.
    const query = {
        where: JSON.stringify({ status: { $eq: 'active' } }),
        order: JSON.stringify({ name: 'ASC' }),
    };

    beforeAll(async () => {
        const moduleRef = await createCrudTestingModule(
            { entity: User, path: 'users', routes: { findMany: { enabled: true }, create: { enabled: true } } },
            [CrudMethodOverrideModule.forRoot()],
        );
        app = moduleRef.createNestApplication();
        app.useGlobalPipes(new ValidationPipe());
        await app.init();

        const ds = app.get(DataSource);
        await seedTestData(ds, ds.getRepository(User));
    });

    afterAll(async () => {
        await app.close();
    });

    const server = () => app.getHttpServer();

    it('header override returns a result identical to a direct GET', async () => {
        const direct = await request(server()).get('/users').query(query).expect(200);
        const overridden = await request(server())
            .post('/users')
            .set('X-HTTP-Method-Override', 'GET')
            .send(query)
            .expect(200);

        expect(overridden.body).toEqual(direct.body);
        expect(overridden.body.items.length).toBeGreaterThan(0); // the filter actually applied
        expect(overridden.body.total).toBe(direct.body.total);
    });

    it('body override (_method: GET) is identical to a direct GET and strips _method', async () => {
        const direct = await request(server()).get('/users').query(query).expect(200);
        const overridden = await request(server())
            .post('/users')
            .send({ ...query, _method: 'GET' })
            .expect(200);

        expect(overridden.body).toEqual(direct.body);
    });

    it('a genuine POST create (no override marker) still creates', async () => {
        const res = await request(server())
            .post('/users')
            .send({ name: 'Created Person', email: 'created@example.com', status: 'inactive' })
            .expect(201);

        expect(res.body).toMatchObject({ name: 'Created Person', email: 'created@example.com' });
        expect(res.body.id).toBeDefined();
    });

    it('a huge $in filter that would overflow a URL travels fine in the body', async () => {
        const ids = Array.from({ length: 500 }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`);
        const big = { where: JSON.stringify({ id: { $in: ids } }) }; // ~20 KB as a URL; fine as a body

        const res = await request(server())
            .post('/users')
            .set('X-HTTP-Method-Override', 'GET')
            .send(big)
            .expect(200);

        expect(res.body).toHaveProperty('items');
        expect(res.body).toHaveProperty('total');
    });
});
