import { INestApplication, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';

import { createCrudTestApp } from '../helper/testing-module';
import { seedTestData } from '../helper/seed-data';
import { User } from '../helper/entities/user-test.entity';
import { CrudService } from '../../lib/service/crud-service';
import { OrderedItem } from '../helper/entities/ordered-item-test.entity';

describe('CrudService / factory bug fixes', () => {
    describe('boolean route shorthand', () => {
        let app: INestApplication;

        beforeAll(async () => {
            app = await createCrudTestApp({
                entity: User,
                path: 'users',
                // `true`/`false` shorthand must merge with the default path/method.
                routes: { findMany: true, findOne: true, create: false } as any,
            });
        });

        afterAll(async () => {
            await app.close();
        });

        it('enables a route configured as `true`', async () => {
            await request(app.getHttpServer()).get('/users').expect(200);
        });

        it('disables a route configured as `false`', async () => {
            await request(app.getHttpServer()).post('/users').send({ name: 'x' }).expect(404);
        });
    });

    describe('behaviour', () => {
        let app: INestApplication;
        let dataSource: DataSource;

        beforeAll(async () => {
            app = await createCrudTestApp({
                entity: User,
                path: 'users',
                routes: {
                    findMany: { enabled: true },
                    findOne: { enabled: true },
                    counts: { enabled: true },
                    create: { enabled: true },
                    createMany: { enabled: true },
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

        it('returns 400 (not 500) when creating with an empty body', async () => {
            await request(app.getHttpServer()).post('/users').send({}).expect(400);
        });

        it('returns 400 for an invalid counts groupByKey', async () => {
            await request(app.getHttpServer())
                .get('/users/get/counts')
                .query({ groupByKey: 'definitelyNotAColumn' })
                .expect(400);
        });

        it('createMany returns fully reloaded entities', async () => {
            const res = await request(app.getHttpServer())
                .post('/users/bulk')
                .send({ bulk: [{ name: 'A' }, { name: 'B' }] })
                .expect(201);

            expect(res.body).toHaveLength(2);
            for (const user of res.body) {
                expect(user.id).toBeDefined();
                expect(user.createdAt).toBeDefined();
            }
        });

        it('honours the query builder returned by beforeFindOne', async () => {
            await seedTestData(dataSource, dataSource.getRepository(User));
            const repo = dataSource.getRepository(User) as Repository<User>;
            const existing = await repo.findOne({ where: {} });

            // Returns a NEW builder that matches nothing. If findOne ignored the
            // return value (the old bug), it would still resolve the record.
            class ScopedService extends CrudService<User> {
                protected async beforeFindOne(qb: any) {
                    return qb.clone().andWhere('1 = 0');
                }
            }
            const scoped = new ScopedService(repo);

            await expect(scoped.findOne(existing!.id)).rejects.toBeInstanceOf(NotFoundException);
        });

        it('reorder() updates order fields atomically', async () => {
            const repo = dataSource.getRepository(OrderedItem);
            const a = await repo.save(repo.create({ name: 'a' }));
            const b = await repo.save(repo.create({ name: 'b' }));
            const c = await repo.save(repo.create({ name: 'c' }));

            const service = new CrudService(repo);
            await service.reorder([c.id, a.id, b.id]);

            const byId = Object.fromEntries((await repo.find()).map((i) => [i.id, i.order]));
            expect(byId[c.id]).toBe(0);
            expect(byId[a.id]).toBe(1);
            expect(byId[b.id]).toBe(2);
        });
    });

    describe('maxPerPage cap', () => {
        let app: INestApplication;

        beforeAll(async () => {
            app = await createCrudTestApp({
                entity: User,
                path: 'users',
                maxPerPage: 5,
                routes: { findMany: { enabled: true } },
            });
        });

        afterAll(async () => {
            await app.close();
        });

        it('rejects take above the configured maxPerPage', async () => {
            await request(app.getHttpServer()).get('/users').query({ take: 10 }).expect(400);
        });

        it('allows take within the configured maxPerPage', async () => {
            await request(app.getHttpServer()).get('/users').query({ take: 5 }).expect(200);
        });
    });
});
