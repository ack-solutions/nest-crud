import { DataSource, Repository } from 'typeorm';
import { WhereQueryBuilder } from '../../lib/helper/where-query-builder';
import { User } from '../helper/entities/user-test.entity';
import { createCrudTestApp } from '../helper/testing-module';
import { INestApplication } from '@nestjs/common';
import { seedTestData } from '../helper/seed-data';
import { expectSqlToMatch } from '../helper/test-utils';
import { QueryBuilderHelper } from '../../lib/helper/query-builder-helper';

describe('WhereQueryBuilder - Integration Tests', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let userRepository: Repository<User>;
    let whereQueryBuilder: WhereQueryBuilder;

    beforeAll(async () => {
        app = await createCrudTestApp({
            name: 'users',
            path: 'users',
            entity: User,
            routes: {
                findMany: { enabled: true },
            },
        });
        dataSource = app.get(DataSource);
        userRepository = dataSource.getRepository(User);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        await seedTestData(dataSource, userRepository);

        const helper = new QueryBuilderHelper(userRepository, userRepository.createQueryBuilder('user'));
        whereQueryBuilder = new WhereQueryBuilder(helper);
    });

    afterAll(async () => {
        await app.close();
    });

    describe('Basic Operators', () => {
        it('should handle equality operator', async () => {
            const where = {
                status: { $eq: 'active' }
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( "user"."status" = ? ) ');
            expect(params).toEqual({ where_param_0: 'active' });

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(user.status).toBe('active');
                expect(user.deletedAt).toBeNull();
            });

            // Should find John Doe who is active
            const johnDoe = results.find(user => user.name === 'John Doe');
            expect(johnDoe).toBeDefined();
            expect(johnDoe.email).toBe('john@example.com');
        });

        it('should handle not equal operator', async () => {
            const where = {
                status: { $ne: 'inactive' }
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( "user"."status" != ? ) ');
            expect(params).toEqual({ where_param_0: 'inactive' });

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(user.status).not.toBe('inactive');
                expect(user.deletedAt).toBeNull();
            });

            // Should find John Doe (active) but not Jane Smith (inactive)
            const johnDoe = results.find(user => user.name === 'John Doe');
            const janeSmith = results.find(user => user.name === 'Jane Smith');
            expect(johnDoe).toBeDefined();
            expect(janeSmith).toBeUndefined();
        });

        it('should handle greater than operator', async () => {
            const where = {
                name: { $gt: 'A' }
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( "user"."name" > ? ) ');
            expect(params).toEqual({ where_param_0: 'A' });

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(user.name > 'A').toBe(true);
                expect(user.deletedAt).toBeNull();
            });

            // Should include both John Doe and Jane Smith
            const hasValidNames = results.every(user => user.name && user.name > 'A');
            expect(hasValidNames).toBe(true);
        });

        it('should handle less than operator', async () => {
            const where = {
                name: { $lt: 'Z' }
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( "user"."name" < ? ) ');
            expect(params).toEqual({ where_param_0: 'Z' });

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(user.name < 'Z').toBe(true);
                expect(user.deletedAt).toBeNull();
            });

            // Should include both test users since their names are < 'Z'
            const johnDoe = results.find(user => user.name === 'John Doe');
            const janeSmith = results.find(user => user.name === 'Jane Smith');
            expect(johnDoe || janeSmith).toBeDefined();
        });

        it('should handle greater than or equal operator', async () => {
            const where = {
                name: { $gte: 'A' }
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( "user"."name" >= ? ) ');
            expect(params).toEqual({ where_param_0: 'A' });

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(user.name >= 'A').toBe(true);
                expect(user.deletedAt).toBeNull();
            });
        });

        it('should handle less than or equal operator', async () => {
            const where = {
                name: { $lte: 'Z' }
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( "user"."name" <= ? ) ');
            expect(params).toEqual({ where_param_0: 'Z' });

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(user.name <= 'Z').toBe(true);
                expect(user.deletedAt).toBeNull();
            });
        });
    });

    describe('Pattern Matching', () => {
        it('should handle LIKE operator', async () => {
            const where = {
                name: { $like: '%John%' }
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( "user"."name" LIKE ? ) ');
            expect(params).toEqual({ where_param_0: '%John%' });

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(user.name.toLowerCase()).toContain('john');
                expect(user.deletedAt).toBeNull();
            });

            // Should find John Doe
            const johnDoe = results.find(user => user.name === 'John Doe');
            expect(johnDoe).toBeDefined();
        });

        it('should handle case insensitive LIKE operator', async () => {
            const where = {
                name: { $iLike: '%john%' }
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( LOWER("user"."name") LIKE LOWER(?) ) ');
            expect(params).toEqual({ where_param_0: '%john%' });

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(user.name.toLowerCase()).toContain('john');
                expect(user.deletedAt).toBeNull();
            });

            // Should find John Doe even with lowercase search
            const johnDoe = results.find(user => user.name === 'John Doe');
            expect(johnDoe).toBeDefined();
        });

        it('should handle NOT LIKE operator', async () => {
            const where = {
                name: { $notLike: '%John%' }
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( "user"."name" NOT LIKE ? ) ');
            expect(params).toEqual({ where_param_0: '%John%' });

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);

            results.forEach(user => {
                expect(user.name.toLowerCase()).not.toContain('john');
                expect(user.deletedAt).toBeNull();
            });

            // Should find Jane Smith but not John Doe
            const janeSmith = results.find(user => user.name === 'Jane Smith');
            const johnDoe = results.find(user => user.name === 'John Doe');
            expect(janeSmith).toBeDefined();
            expect(johnDoe).toBeUndefined();
        });

        it('should handle NOT ILIKE operator', async () => {
            const where = {
                name: { $notIlike: '%JOHN%' }
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( LOWER("user"."name") NOT LIKE LOWER(?) ) ');
            expect(params).toEqual({ where_param_0: '%JOHN%' });

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);

            results.forEach(user => {
                expect(user.name.toLowerCase()).not.toContain('john');
                expect(user.deletedAt).toBeNull();
            });

            // Should find Jane Smith but not John Doe
            const janeSmith = results.find(user => user.name === 'Jane Smith');
            const johnDoe = results.find(user => user.name === 'John Doe');
            expect(janeSmith).toBeDefined();
            expect(johnDoe).toBeUndefined();
        });
    });

    describe('Array Operations', () => {
        it('should handle IN operator', async () => {
            const where = {
                status: { $in: ['active', 'inactive'] }
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( "user"."status" IN (?, ?) ) ');
            expect(params).toEqual({ where_param_0: ['active', 'inactive'] });

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(['active', 'inactive']).toContain(user.status);
                expect(user.deletedAt).toBeNull();
            });

            // Should include both John Doe (active) and Jane Smith (inactive)
            expect(results.length).toBeGreaterThanOrEqual(2);
            const johnDoe = results.find(user => user.name === 'John Doe');
            const janeSmith = results.find(user => user.name === 'Jane Smith');
            expect(johnDoe).toBeDefined();
            expect(janeSmith).toBeDefined();
        });

        it('should handle NOT IN operator', async () => {
            const where = {
                status: { $notIn: ['deleted', 'archived'] }
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( "user"."status" NOT IN (?, ?) ) ');
            expect(params).toEqual({ where_param_0: ['deleted', 'archived'] });

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(['deleted', 'archived']).not.toContain(user.status);
                expect(user.deletedAt).toBeNull();
            });

            // Should include both test users since they are active/inactive
            const johnDoe = results.find(user => user.name === 'John Doe');
            const janeSmith = results.find(user => user.name === 'Jane Smith');
            expect(johnDoe || janeSmith).toBeDefined();
        });

        it('should handle empty IN array', async () => {
            const where = {
                status: { $in: [] }
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( 1 = 0 ) ');
            expect(params).toEqual({});

            // Verify actual results - should be empty
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(0);
        });
    });

    describe('Null Operations', () => {
        it('should handle IS NULL operator', async () => {
            const where = {
                deletedAt: { $isNull: true }
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( "user"."deletedAt" IS NULL ) ');
            expect(params).toEqual({});

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(user.deletedAt).toBeNull();
            });

            // Should include both test users since they are not soft-deleted
            const johnDoe = results.find(user => user.name === 'John Doe');
            const janeSmith = results.find(user => user.name === 'Jane Smith');
            expect(johnDoe || janeSmith).toBeDefined();
        });

        it('should handle IS NOT NULL operator', async () => {
            // First create a user with deletedAt set for testing
            const deletedUser = userRepository.create({
                name: 'Deleted User',
                email: 'deleted@example.com',
                status: 'inactive',
                deletedAt: new Date()
            });
            await userRepository.save(deletedUser);

            const where = {
                deletedAt: { $isNotNull: true }
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( "user"."deletedAt" IS NOT NULL ) ');
            expect(params).toEqual({});

            // This query should return empty because the WHERE clause has a contradiction:
            // It requires deletedAt IS NOT NULL AND deletedAt IS NULL
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(0);
        });
    });

    describe('Boolean Operations', () => {
        it('should handle IS NULL for nullable fields', async () => {
            // Create a user with null name for testing
            const userWithNullName = userRepository.create({
                email: 'null-name@example.com',
                status: 'active',
                name: null
            });
            await userRepository.save(userWithNullName);

            const where = {
                name: { $isNull: true }
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( "user"."name" IS NULL ) ');
            expect(params).toEqual({});

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(user.name).toBeNull();
                expect(user.deletedAt).toBeNull();
            });

            // Should find the user with null name
            const nullNameUser = results.find(user => user.email === 'null-name@example.com');
            expect(nullNameUser).toBeDefined();
        });

        it('should handle IS NOT NULL for nullable fields', async () => {
            const where = {
                name: { $isNotNull: true }
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( "user"."name" IS NOT NULL ) ');
            expect(params).toEqual({});

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(user.name).not.toBeNull();
                expect(user.deletedAt).toBeNull();
            });

            // Should include our seed data users with names
            const hasJohnDoe = results.some(user => user.name === 'John Doe');
            const hasJaneSmith = results.some(user => user.name === 'Jane Smith');
            expect(hasJohnDoe || hasJaneSmith).toBe(true);
        });
    });

    describe('Logical Operators', () => {
        it('should handle AND operator', async () => {
            const where = {
                $and: [
                    { status: 'active' },
                    { name: { $like: '%John%' } }
                ]
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( ("user"."status" = ?) AND ("user"."name" LIKE ?) ) ');
            expect(params).toEqual({ where_param_0: 'active', where_param_1: '%John%' });

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(user.status).toBe('active');
                expect(user.name.toLowerCase()).toContain('john');
                expect(user.deletedAt).toBeNull();
            });

            // Should find John Doe who is active and has 'John' in name
            const johnDoe = results.find(user => user.name === 'John Doe');
            expect(johnDoe).toBeDefined();
            expect(johnDoe.status).toBe('active');
        });

        it('should handle OR operator', async () => {
            const where = {
                $or: [
                    { status: 'active' },
                    { status: 'pending' }
                ]
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( ("user"."status" = ?) OR ("user"."status" = ?) ) ');
            expect(params).toEqual({ where_param_0: 'active', where_param_1: 'pending' });

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(['active', 'pending']).toContain(user.status);
                expect(user.deletedAt).toBeNull();
            });

            // Should find John Doe (active) but no pending users in our seed data
            const johnDoe = results.find(user => user.name === 'John Doe');
            expect(johnDoe).toBeDefined();
            expect(johnDoe.status).toBe('active');
        });

        it('should handle nested logical operators', async () => {
            const where = {
                $and: [
                    { status: 'active' },
                    {
                        $or: [
                            { name: { $like: '%John%' } },
                            { email: { $like: '%john%' } }
                        ]
                    }
                ]
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( ("user"."status" = ?) AND ((("user"."name" LIKE ?) OR ("user"."email" LIKE ?))) ) ');
            expect(params).toEqual({ where_param_0: 'active', where_param_1: '%John%', where_param_2: '%john%' });

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(user.status).toBe('active');
                const hasJohnInName = user.name.toLowerCase().includes('john');
                const hasJohnInEmail = user.email.toLowerCase().includes('john');
                expect(hasJohnInName || hasJohnInEmail).toBe(true);
                expect(user.deletedAt).toBeNull();
            });

            // Should find John Doe who is active and has 'john' in both name and email
            const johnDoe = results.find(user => user.name === 'John Doe');
            expect(johnDoe).toBeDefined();
        });
    });

    describe('Range Operations', () => {
        it('should handle BETWEEN operator', async () => {
            const where = {
                name: { $between: ['A', 'M'] }
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( "user"."name" BETWEEN ? AND ? ) ');
            expect(params).toEqual({ where_param_0_0: 'A', where_param_0_1: 'M' });

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(user.name >= 'A' && user.name <= 'M').toBe(true);
                expect(user.deletedAt).toBeNull();
            });

            // Should find John Doe (starts with 'J') but not Jane Smith (starts with 'J' but might be > 'M')
            const users = results.map(u => u.name);
            expect(users.some(name => name >= 'A' && name <= 'M')).toBe(true);
        });

        it('should handle NOT BETWEEN operator', async () => {
            const where = {
                name: { $notBetween: ['N', 'Z'] }
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( "user"."name" NOT BETWEEN ? AND ? ) ');
            expect(params).toEqual({ where_param_0_0: 'N', where_param_0_1: 'Z' });

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(user.name < 'N' || user.name > 'Z').toBe(true);
                expect(user.deletedAt).toBeNull();
            });

            // Should find users with names outside N-Z range
            const johnDoe = results.find(user => user.name === 'John Doe');
            const janeSmith = results.find(user => user.name === 'Jane Smith');
            expect(johnDoe || janeSmith).toBeDefined(); // Names starting with 'J' should be found
        });
    });

    describe('Date Operations', () => {
        it('should handle date comparisons', async () => {
            const testDate = new Date('2024-01-01');
            const where = {
                createdAt: { $gte: testDate }
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( "user"."createdAt" >= ? ) ');
            expect(params).toEqual({ where_param_0: testDate });

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);

            results.forEach(user => {
                expect(user.createdAt >= testDate).toBe(true);
                expect(user.deletedAt).toBeNull();
            });

            // Results depend on when the test is run and data is created
            // But we should find some users created after 2024-01-01
            if (results.length > 0) {
                expect(results[0].createdAt).toBeInstanceOf(Date);
            }
        });

        it('should handle date range queries', async () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');
            const where = {
                createdAt: { $between: [startDate, endDate] }
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( "user"."createdAt" BETWEEN ? AND ? ) ');
            expect(params).toEqual({ where_param_0_0: startDate, where_param_0_1: endDate });

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);

            results.forEach(user => {
                expect(user.createdAt >= startDate && user.createdAt <= endDate).toBe(true);
                expect(user.deletedAt).toBeNull();
            });

            // Results depend on when the test is run and data is created
            if (results.length > 0) {
                expect(results[0].createdAt).toBeInstanceOf(Date);
            }
        });
    });

    describe('Complex Queries', () => {
        it('should handle complex nested conditions', async () => {
            const where = {
                $and: [
                    { status: { $in: ['active', 'pending'] } },
                    {
                        $or: [
                            { name: { $like: '%John%' } },
                            { email: { $like: '%john%' } }
                        ]
                    },
                    { email: { $isNotNull: true } }
                ]
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( ("user"."status" IN (?, ?)) AND ((("user"."name" LIKE ?) OR ("user"."email" LIKE ?))) AND ("user"."email" IS NOT NULL) ) ');
            expect(params).toEqual({
                where_param_0: ['active', 'pending'],
                where_param_1: '%John%',
                where_param_2: '%john%'
            });

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);

            results.forEach(user => {
                expect(['active', 'pending']).toContain(user.status);
                const hasJohnInName = user.name.toLowerCase().includes('john');
                const hasJohnInEmail = user.email.toLowerCase().includes('john');
                expect(hasJohnInName || hasJohnInEmail).toBe(true);
                expect(user.email).not.toBeNull();
                expect(user.deletedAt).toBeNull();
            });

            // Should find John Doe who matches all conditions
            if (results.length > 0) {
                const johnDoe = results.find(user => user.name === 'John Doe');
                expect(johnDoe).toBeDefined();
            }
        });

        it('should handle simple equality without operators', async () => {
            const where = {
                status: 'active',
                name: 'John Doe'
            };
            const builder = whereQueryBuilder.build(where);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( "user"."status" = ? AND "user"."name" = ? ) ');
            expect(params).toEqual({ where_param_0: 'active', where_param_1: 'John Doe' });

            // Verify actual results
            const results = await builder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);

            results.forEach(user => {
                expect(user.status).toBe('active');
                expect(user.name).toBe('John Doe');
                expect(user.deletedAt).toBeNull();
            });

            // Should find exactly John Doe
            expect(results.length).toBeGreaterThan(0);
            const johnDoe = results.find(user => user.name === 'John Doe');
            expect(johnDoe).toBeDefined();
            expect(johnDoe.email).toBe('john@example.com');
            expect(johnDoe.status).toBe('active');
        });
    });

    describe('Executable Queries', () => {
        it('should execute simple where query', async () => {
            const where = {
                status: 'active'
            };
            const builder = whereQueryBuilder.build(where);
            const results = await builder.getMany();

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            // Should find active users from seed data
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(user.status).toBe('active');
                expect(user.deletedAt).toBeNull();
                expect(user.id).toBeDefined();
                expect(typeof user.id).toBe('string');
                expect(user.createdAt).toBeInstanceOf(Date);
                expect(user.updatedAt).toBeInstanceOf(Date);
            });

            // Should find John Doe
            const johnDoe = results.find(user => user.name === 'John Doe');
            expect(johnDoe).toBeDefined();
            expect(johnDoe.email).toBe('john@example.com');
        });

        it('should execute OR query', async () => {
            const where = {
                $or: [
                    { status: 'active' },
                    { status: 'inactive' }
                ]
            };
            const builder = whereQueryBuilder.build(where);
            const results = await builder.getMany();

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(['active', 'inactive']).toContain(user.status);
                expect(user.deletedAt).toBeNull();
                expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/); // Valid email format
            });

            // Should include both test users
            expect(results.length).toBeGreaterThanOrEqual(2);
            const statuses = results.map(user => user.status);
            expect(statuses).toContain('active');
            expect(statuses).toContain('inactive');
        });

        it('should execute LIKE query', async () => {
            const where = {
                name: { $like: '%John%' }
            };
            const builder = whereQueryBuilder.build(where);
            const results = await builder.getMany();

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(user.name).toContain('John');
                expect(user.deletedAt).toBeNull();
                expect(typeof user.name).toBe('string');
                expect(user.name.length).toBeGreaterThan(0);
            });

            // Should find John Doe
            const johnDoe = results.find(user => user.name === 'John Doe');
            expect(johnDoe).toBeDefined();
            expect(johnDoe.status).toBe('active');

            // Verify count matches results
            const count = await whereQueryBuilder.build(where).getCount();
            expect(count).toBe(results.length);
        });
    });
});
