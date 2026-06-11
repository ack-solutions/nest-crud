import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { createCrudTestApp } from '../helper/testing-module';
import { seedTestData } from '../helper/seed-data';
import { User } from '../helper/entities/user-test.entity';
import { CrudService } from '../../lib/service/crud-service';
import { QueryBuilder } from '../../../../nest-crud-request/src/lib/query-builder';
import { AggregateFnEnum, OrderDirectionEnum, WhereOperatorEnum } from '../../../../nest-crud-request/src/lib/types';

/**
 * v2.1 — the client `QueryBuilder` serialises aggregates / having exactly the way the
 * server `RequestQueryParser` parses them, so a request built on the client runs
 * end-to-end on the server.
 */
describe('Client → server round-trip (aggregates + having + order)', () => {
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

    it('serialises aggregates/having as JSON strings (HTTP shape)', () => {
        const params = new QueryBuilder()
            .addAggregate({ fn: AggregateFnEnum.COUNT, field: 'posts.id', as: 'postCount' })
            .having('postCount', WhereOperatorEnum.GT, 1)
            .addOrder('postCount', OrderDirectionEnum.DESC)
            .toObject();

        expect(typeof params.aggregates).toBe('string');
        expect(JSON.parse(params.aggregates as string)).toEqual([{ fn: 'count', field: 'posts.id', as: 'postCount' }]);
        expect(JSON.parse(params.having as string)).toEqual({ postCount: { $gt: 1 } });
        expect(JSON.parse(params.order as string)).toEqual({ postCount: 'DESC' });
    });

    it('nested mode keeps aggregates as an array and having as an object', () => {
        const params = new QueryBuilder()
            .addAggregate({ fn: AggregateFnEnum.SUM, field: 'posts.likes', as: 'likesSum' })
            .having('likesSum', WhereOperatorEnum.GT_OR_EQ, 20)
            .toObject(true);

        expect(params.aggregates).toEqual([{ fn: 'sum', field: 'posts.likes', as: 'likesSum' }]);
        expect(params.having).toEqual({ likesSum: { $gte: 20 } });
    });

    it('runs end-to-end on the server', async () => {
        const params = new QueryBuilder()
            .addAggregate({ fn: AggregateFnEnum.COUNT, field: 'posts.id', as: 'postCount' })
            .having('postCount', WhereOperatorEnum.GT, 1)
            .addOrder('postCount', OrderDirectionEnum.DESC)
            .toObject();

        const res = await service.findMany(params as any);

        expect(res.total).toBe(1);
        expect(res.items).toHaveLength(1);
        expect(res.items[0].name).toBe('John Doe');
        expect((res.items[0] as any).postCount).toBe(2);
    });
});
