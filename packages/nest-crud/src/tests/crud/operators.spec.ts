import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { createCrudTestApp } from '../helper/testing-module';
import { seedTestData } from '../helper/seed-data';
import { User } from '../helper/entities/user-test.entity';
import { CrudService } from '../../lib/service/crud-service';
import { WhereOperatorRegistry } from '../../lib/helper/where-operators';
import { WhereOperatorEnum as ServerWhereOperatorEnum } from '../../lib/types';
import { WhereOperatorEnum as ClientWhereOperatorEnum } from '../../../../nest-crud-request/src/lib/types';

/**
 * v2.1 — operator registry, client/server drift guard, the new built-in operators
 * (`$ieq`, `$exists`, `$notExists`) and consumer-registered custom operators.
 */
describe('Operators (registry, drift guard, new operators, extensibility)', () => {
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

    describe('type-drift guard (client ↔ server)', () => {
        it('client and server WhereOperatorEnum expose identical token sets', () => {
            const server = Object.values(ServerWhereOperatorEnum).sort();
            const client = Object.values(ClientWhereOperatorEnum).sort();
            expect(server).toEqual(client);
        });

        it('every column operator token has a registry handler (except relation-level ones)', () => {
            const relationLevel = new Set<string>([
                ServerWhereOperatorEnum.EXISTS,
                ServerWhereOperatorEnum.NOT_EXISTS,
            ]);
            for (const token of Object.values(ServerWhereOperatorEnum)) {
                if (relationLevel.has(token)) {
                    continue;
                }
                expect(WhereOperatorRegistry.has(token)).toBe(true);
            }
        });
    });

    describe('$ieq — case-insensitive equality', () => {
        it('matches regardless of case', async () => {
            const res = await service.findMany({ where: JSON.stringify({ name: { $ieq: 'jOhN dOe' } }) } as any);
            expect(res.items).toHaveLength(1);
            expect(res.items[0].name).toBe('John Doe');
        });
    });

    describe('$exists / $notExists — relation existence', () => {
        it('$exists: true returns only rows that have related rows', async () => {
            await repo.save(repo.create({ name: 'No Posts', email: 'np@example.com', status: 'active' }));
            const res = await service.findMany({ where: JSON.stringify({ posts: { $exists: true } }) } as any);
            expect(res.items.map((u) => u.name).sort()).toEqual(['Jane Smith', 'John Doe']);
        });

        it('$notExists: true returns only rows without related rows', async () => {
            await repo.save(repo.create({ name: 'No Posts', email: 'np@example.com', status: 'active' }));
            const res = await service.findMany({ where: JSON.stringify({ posts: { $notExists: true } }) } as any);
            expect(res.items.map((u) => u.name)).toEqual(['No Posts']);
        });

        it('$exists: false is equivalent to $notExists: true', async () => {
            await repo.save(repo.create({ name: 'No Posts', email: 'np@example.com', status: 'active' }));
            const res = await service.findMany({ where: JSON.stringify({ posts: { $exists: false } }) } as any);
            expect(res.items.map((u) => u.name)).toEqual(['No Posts']);
        });
    });

    describe('custom operator via WhereOperatorRegistry.register()', () => {
        afterAll(() => {
            WhereOperatorRegistry.unregister('$ciContains');
        });

        it('a consumer-registered operator works end-to-end', async () => {
            WhereOperatorRegistry.register('$ciContains', ({ column, value, param }) => ({
                query: `LOWER(${column}) LIKE LOWER(:${param})`,
                params: { [param]: `%${value}%` },
            }));

            const res = await service.findMany({ where: JSON.stringify({ name: { $ciContains: 'OHN' } }) } as any);
            expect(res.items.map((u) => u.name)).toContain('John Doe');
        });

        it('unregister removes the custom operator (falls back to a 400)', async () => {
            WhereOperatorRegistry.register('$temp', ({ column, value, param }) => ({ query: `${column} = :${param}`, params: { [param]: value } }));
            expect(WhereOperatorRegistry.has('$temp')).toBe(true);
            WhereOperatorRegistry.unregister('$temp');
            expect(WhereOperatorRegistry.has('$temp')).toBe(false);

            await expect(
                service.findMany({ where: JSON.stringify({ name: { $temp: 'x' } }) } as any),
            ).rejects.toThrow();
        });
    });
});
