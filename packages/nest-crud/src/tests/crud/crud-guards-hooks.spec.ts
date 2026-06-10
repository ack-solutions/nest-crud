import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';

import { createCrudTestApp } from '../helper/testing-module';
import { User } from '../helper/entities/user-test.entity';
import { CrudService } from '../../lib/service/crud-service';
import { TestGuard } from '../helper/guard';
import { TestInterceptor } from '../helper/interceptor';

describe('Guards, interceptors, and lifecycle hooks', () => {
    describe('per-route guards', () => {
        let app: INestApplication;

        beforeAll(async () => {
            app = await createCrudTestApp({
                entity: User,
                path: 'users',
                routes: {
                    create: { enabled: true, guards: [TestGuard] },
                    findMany: { enabled: true },
                },
            });
        });

        afterAll(async () => {
            await app.close();
        });

        it('blocks the route when the guard denies', async () => {
            await request(app.getHttpServer()).post('/users').send({ name: 'x' }).expect(403);
        });

        it('allows the route when the guard passes', async () => {
            await request(app.getHttpServer()).post('/users').query({ allow: 'true' }).send({ name: 'x' }).expect(201);
        });
    });

    describe('per-route interceptors', () => {
        let app: INestApplication;

        beforeAll(async () => {
            app = await createCrudTestApp({
                entity: User,
                path: 'users',
                routes: {
                    findMany: { enabled: true, interceptors: [TestInterceptor] },
                },
            });
        });

        afterAll(async () => {
            await app.close();
        });

        it('applies the interceptor to the response', async () => {
            const res = await request(app.getHttpServer()).get('/users').expect(200);
            expect(res.body.intercepted).toBe(true);
        });
    });

    describe('service lifecycle hooks', () => {
        let app: INestApplication;
        let dataSource: DataSource;

        beforeAll(async () => {
            app = await createCrudTestApp({ entity: User, path: 'users', routes: { findMany: { enabled: true } } });
            dataSource = app.get(DataSource);
        });

        afterAll(async () => {
            await app.close();
        });

        beforeEach(async () => {
            await dataSource.synchronize(true);
        });

        it('beforeCreate can transform the payload', async () => {
            class HookService extends CrudService<User> {
                protected async beforeCreate(entity: any) {
                    return { ...entity, name: String(entity.name).toUpperCase() };
                }
            }
            const service = new HookService(dataSource.getRepository(User));
            const created = await service.create({ name: 'alice' } as any);
            expect(created.name).toBe('ALICE');
        });

        it('beforeFindMany can scope list queries', async () => {
            const repo = dataSource.getRepository(User);
            await repo.save(repo.create({ name: 'keep', status: 'active' }));
            await repo.save(repo.create({ name: 'drop', status: 'inactive' }));

            class ScopedService extends CrudService<User> {
                protected async beforeFindMany(qb: any) {
                    return qb.andWhere(`${qb.alias}.status = :status`, { status: 'active' });
                }
            }
            const service = new ScopedService(repo);
            const res = await service.findMany({} as any);

            expect(res.total).toBe(1);
            expect(res.items[0].name).toBe('keep');
        });
    });
});
