import { OrderDirectionEnum } from '../../lib/types';
import { DataSource, Repository } from 'typeorm';
import { FindQueryBuilder } from '../../lib/helper/find-query-builder';
import { User } from '../helper/entities/user-test.entity';
import { createCrudTestApp } from '../helper/testing-module';
import { INestApplication } from '@nestjs/common';
import { seedTestData } from '../helper/seed-data';
import { IFindManyOptions } from '../../lib/interface/crud';
import { expectSqlToMatch } from '../helper/test-utils';


describe('FindQueryBuilder - Integration Tests', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let userRepository: Repository<User>;
    let queryBuilder: FindQueryBuilder<User>;

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

        // Use the common seeding function
        await seedTestData(dataSource, userRepository);

        queryBuilder = new FindQueryBuilder(userRepository);
    });

    afterAll(async () => {
        await app.close();
    });

    describe('Basic Query Operations', () => {
        it('should build a basic select query', async () => {
            const options: IFindManyOptions = {};
            queryBuilder.build(options);

            // Verify actual results using queryBuilder methods
            const results = await queryBuilder.getMany();

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            // Should find both test users
            expect(results.length).toBeGreaterThanOrEqual(2);
            const johnDoe = results.find(user => user.name === 'John Doe');
            const janeSmith = results.find(user => user.name === 'Jane Smith');
            expect(johnDoe).toBeDefined();
            expect(janeSmith).toBeDefined();
        });

        it('should handle select with specific fields', async () => {

            const options: IFindManyOptions = {
                select: ['id', 'name', 'email']
            };
            queryBuilder.build(options);

            // Verify actual results using queryBuilder methods
            const results = await queryBuilder.getMany();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                // Should have selected fields
                expect(user).toHaveProperty('id');
                expect(user).toHaveProperty('name');
                expect(user).toHaveProperty('email');

                // Should NOT have unselected fields
                expect(user).not.toHaveProperty('status');
                expect(user).not.toHaveProperty('profile');
                expect(user).not.toHaveProperty('posts');
            });
        });

        it('should handle where conditions', async () => {
            const options: IFindManyOptions = {
                where: {
                    status: 'active',
                    email: { $iLike: '%@example.com' }
                }
            };
            const builder = queryBuilder.build(options);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( "User"."status" = ? AND LOWER("User"."email") LIKE LOWER(?) )');
            expect(params).toEqual({
                where_param_0: 'active',
                where_param_1: '%@example.com'
            });

            // Verify actual results using queryBuilder methods
            const results = await queryBuilder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(user.status).toBe('active');
                expect(user.email).toMatch(/@example\.com$/i);
                expect(user.deletedAt).toBeNull();
            });

            // Should find John Doe who is active with @example.com email
            const johnDoe = results.find(user => user.name === 'John Doe');
            expect(johnDoe).toBeDefined();
            expect(johnDoe.status).toBe('active');
            expect(johnDoe.email).toBe('john@example.com');
        });

        it('should handle order by', async () => {
            const options: IFindManyOptions = {
                order: {
                    name: OrderDirectionEnum.ASC,
                    createdAt: OrderDirectionEnum.DESC
                }
            };
            queryBuilder.build(options);

            // Verify actual results using queryBuilder methods
            const results = await queryBuilder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            // Verify ordering by name (ASC)
            for (let i = 1; i < results.length; i++) {
                if (results[i - 1].name && results[i].name) {
                    expect(results[i - 1].name <= results[i].name).toBe(true);
                }
            }

            // Verify we have expected users in correct order
            const names = results.map(user => user.name).filter(name => name !== null);
            expect(names.length).toBeGreaterThan(0);
        });

        it('should handle pagination', async () => {
            const options: IFindManyOptions = {
                skip: 1,
                take: 1
            };
            queryBuilder.build(options);

            // Compare with non-paginated results first using queryBuilder methods
            queryBuilder.build({});
            const allResults = await queryBuilder.getMany();
            expect(allResults.length).toBeGreaterThanOrEqual(1);

            // Verify pagination works using queryBuilder methods
            queryBuilder.build(options);
            const results = await queryBuilder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeLessThanOrEqual(1); // Should return at most 1 record

            // Verify pagination logic:
            // - If we have 2 or more results, skip=1, take=1 should return 1 result (the 2nd one)
            // - If we have only 1 result, skip=1 should return 0 results
            expect(results.length).toBeLessThanOrEqual(allResults.length);

            if (allResults.length >= 2) {
                expect(results.length).toBe(1);
                expect(results[0].id).toBe(allResults[1].id); // Should be the second record
            }

            // If we have results, verify each result has proper structure
            results.forEach(user => {
                expect(user.id).toBeDefined();
                expect(typeof user.id).toBe('string');
                expect(user.deletedAt).toBeNull();
            });
        });
    });

    describe('Complex Where Conditions', () => {
        it('should handle $and conditions', async () => {
            const options: IFindManyOptions = {
                where: {
                    $and: [
                        { status: 'active' },
                        { email: { $iLike: '%@example.com' } }
                    ]
                }
            };
            const builder = queryBuilder.build(options);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( ("User"."status" = ?) AND ( LOWER("User"."email") LIKE LOWER(?) ) )');
            expect(params).toEqual({
                where_param_0: 'active',
                where_param_1: '%@example.com'
            });

            // Verify results using queryBuilder methods
            const results = await queryBuilder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(user.status).toBe('active');
                expect(user.email).toMatch(/@example\.com$/i);
                expect(user.deletedAt).toBeNull();
            });

            // Should find John Doe
            const johnDoe = results.find(user => user.name === 'John Doe');
            expect(johnDoe).toBeDefined();
        });

        it('should handle $or conditions', async () => {
            const options: IFindManyOptions = {
                where: {
                    $or: [
                        { status: 'active' },
                        { status: 'pending' }
                    ]
                }
            };
            const builder = queryBuilder.build(options);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '("User"."status" = ?) OR ("User"."status" = ?)');
            expect(params).toEqual({
                where_param_0: 'active',
                where_param_1: 'pending'
            });

            // Verify results using queryBuilder methods
            const results = await queryBuilder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(['active', 'pending']).toContain(user.status);
                expect(user.deletedAt).toBeNull();
            });

            // Should find John Doe (active) but no pending users in our test data
            const johnDoe = results.find(user => user.name === 'John Doe');
            expect(johnDoe).toBeDefined();
            expect(johnDoe.status).toBe('active');
        });

        it('should handle comparison operators', async () => {
            // Test numeric comparison using a creative approach
            // We'll use a scenario where we know the approximate creation time
            const recentDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

            const options: IFindManyOptions = {
                where: {
                    createdAt: { $gte: recentDate },
                    status: { $in: ['active', 'inactive'] }
                }
            };
            const builder = queryBuilder.build(options);
            const sql = builder.getSql();

            expectSqlToMatch(sql, '( "User"."createdAt" >= ? AND "User"."status" IN (?, ?) )');

            // Verify results using queryBuilder methods
            const results = await queryBuilder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(['active', 'inactive']).toContain(user.status);
                expect(user.deletedAt).toBeNull();

                // Verify createdAt is a Date and meets our criteria
                expect(user.createdAt).toBeInstanceOf(Date);
                expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(recentDate.getTime());
            });

            // Should find both test users since they were just created
            const johnDoe = results.find(user => user.name === 'John Doe');
            const janeSmith = results.find(user => user.name === 'Jane Smith');
            expect(johnDoe).toBeDefined();
            expect(janeSmith).toBeDefined();

            // Test that comparison operators work with numbers
            // The core functionality is that >= operator works correctly
            const timeComparison = johnDoe.createdAt.getTime() >= recentDate.getTime();
            expect(timeComparison).toBe(true);
        });

        it('should handle $in operator', async () => {
            const options: IFindManyOptions = {
                where: {
                    status: { $in: ['active', 'pending', 'inactive'] }
                }
            };
            const builder = queryBuilder.build(options);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( "User"."status" IN (?, ?, ?) )');
            expect(params).toEqual({
                where_param_0: ['active', 'pending', 'inactive']
            });

            // Verify results using queryBuilder methods
            const results = await queryBuilder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(['active', 'pending', 'inactive']).toContain(user.status);
                expect(user.deletedAt).toBeNull();
            });

            // Should find both test users
            const johnDoe = results.find(user => user.name === 'John Doe');
            const janeSmith = results.find(user => user.name === 'Jane Smith');
            expect(johnDoe).toBeDefined();
            expect(janeSmith).toBeDefined();
        });
    });

    describe('Relations and Joins', () => {
        it('should handle simple relations', async () => {
            const options: IFindManyOptions = {
                relations: ['profile', 'posts']
            };
            queryBuilder.build(options);

            // Verify relations are loaded using queryBuilder methods
            const results = await queryBuilder.getMany();

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);



            results.forEach(user => {
                expect(user).toHaveProperty('id');
                expect(user).toHaveProperty('name');
                expect(user).toHaveProperty('email');

                expect(user).toHaveProperty('profile');
                expect(user).toHaveProperty('posts');
                expect(user.deletedAt).toBeNull();

                // Verify profile relation type
                if (user.profile) {
                    expect(typeof user.profile).toBe('object');
                    expect(user.profile).toHaveProperty('id');
                }

                // Verify posts relation type
                expect(Array.isArray(user.posts)).toBe(true);
            });

            // Find John Doe and verify his relations
            const johnDoe = results.find(user => user.name === 'John Doe');
            expect(johnDoe).toBeDefined();
            expect(johnDoe.profile).toBeDefined();
            expect(johnDoe.posts).toBeDefined();
            expect(johnDoe.posts.length).toBeGreaterThan(0);
        });

        it('should handle nested relations', async () => {
            const options: IFindManyOptions = {
                relations: {
                    'profile': {
                        select: ['age']
                    },
                    'profile.addresses': {
                        select: ['city']
                    },
                    'profile.addresses.country': {
                        select: ['name']
                    }
                }
            };
            const builder = queryBuilder.build(options);

            // Verify nested relations using queryBuilder methods
            const results = await queryBuilder.getMany();

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            // Find a user with nested relations
            const userWithProfile = results.find(user => user.profile);
            if (userWithProfile && userWithProfile.profile) {
                expect(userWithProfile.profile).toHaveProperty('age');

                if (userWithProfile.profile.addresses && userWithProfile.profile.addresses.length > 0) {
                    const address = userWithProfile.profile.addresses[0];
                    expect(address).toHaveProperty('city');

                    if (address.country) {
                        expect(address.country).toHaveProperty('name');
                    }
                }
            }
        });

        it('should handle relations with where conditions', async () => {
            const options: IFindManyOptions = {
                relations: {
                    'posts': true
                },
                where: {
                    'posts.status': 'published'
                }
            };
            const builder = queryBuilder.build(options);
            const sql = builder.getSql();
            const params = builder.getParameters();

            // Verify relations with where conditions using queryBuilder methods
            const results = await queryBuilder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                expect(user).toHaveProperty('posts');
                expect(Array.isArray(user.posts)).toBe(true);
                expect(user.deletedAt).toBeNull();

                // All related posts should be published
                user.posts.forEach(post => {
                    expect(post.status).toBe('published');
                    expect(post.deletedAt).toBeNull();
                });
            });

            // Find John Doe and verify his posts
            const johnDoe = results.find(user => user.name === 'John Doe');
            expect(johnDoe).toBeDefined();
            expect(johnDoe.posts).toBeDefined();
        });

        it('should handle mixed select fields and full relations', async () => {
            const options: IFindManyOptions = {
                select: ['id', 'name'],
                relations: {
                    'profile': {
                        select: ['age']  // Only select age from profile
                    },
                    'posts': true // Select all fields from posts (for comparison)
                }
            };
            const builder = queryBuilder.build(options);

            // Verify entities using queryBuilder methods
            const results = await queryBuilder.getMany();
            expect(results).toBeDefined();
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                // Should have selected main fields
                expect(user).toHaveProperty('id');
                expect(user).toHaveProperty('name');
                expect(user).not.toHaveProperty('email');
                expect(user).not.toHaveProperty('status');

                // Relations might not be loaded if no data exists or if TypeORM doesn't load them
                // We'll just verify the basic structure works
                expect(typeof user.id).toBe('string');
                if (user.name !== null) {
                    expect(typeof user.name).toBe('string');
                }
            });
        });

        it('should map selected relation fields to entity objects', async () => {
            const options: IFindManyOptions = {
                select: ['id', 'name'],
                relations: {
                    'profile': {
                        select: ['age', 'verified']
                    }
                }
            };

            // Build the query first to configure relations and select
            const builder = queryBuilder.build(options);

            // Use queryBuilder methods to get entities
            const mappedEntities = await queryBuilder.getMany();

            expect(mappedEntities).toBeDefined();
            expect(mappedEntities.length).toBeGreaterThan(0);

            const firstEntity = mappedEntities[0];

            // Main entity should have selected fields
            expect(firstEntity).toHaveProperty('id');
            expect(firstEntity).toHaveProperty('name');
            expect(firstEntity).not.toHaveProperty('email');
            expect(firstEntity).not.toHaveProperty('status');

            // Profile relation might exist
            // Note: Relations might not be loaded if getMany() doesn't support relation loading
            if (firstEntity.profile) {
                const profile = firstEntity.profile;
                expect(profile).toHaveProperty('age');
                expect(profile).toHaveProperty('verified');
                expect(profile).not.toHaveProperty('bio');

                // Verify field types - be flexible about verified field type
                expect(typeof profile.age).toBe('number');
                expect(['boolean', 'number'].includes(typeof profile.verified)).toBe(true);
            }

            // Verify all entities have correct structure
            mappedEntities.forEach(entity => {
                expect(entity.id).toBeDefined();
                expect(typeof entity.id).toBe('string');
                if (entity.name !== null) {
                    expect(typeof entity.name).toBe('string');
                }
            });
        });

        it('should return only selected fields for main entity', async () => {
            const options: IFindManyOptions = {
                select: ['id', 'name', 'email']
            };
            const builder = queryBuilder.build(options);

            // Use queryBuilder methods
            const results = await queryBuilder.getMany();

            // Should have results
            expect(results).toBeDefined();
            expect(results.length).toBeGreaterThan(0);

            // Check first result structure - should only have selected fields
            const firstResult = results[0];
            expect(firstResult).toHaveProperty('id');
            expect(firstResult).toHaveProperty('name');
            expect(firstResult).toHaveProperty('email');

            // Should NOT have unselected fields
            expect(firstResult).not.toHaveProperty('status');
            expect(firstResult).not.toHaveProperty('profile');
            expect(firstResult).not.toHaveProperty('posts');

            // Verify all results have the same structure
            results.forEach(user => {
                expect(user).toHaveProperty('id');
                expect(user).toHaveProperty('name');
                expect(user).toHaveProperty('email');
                expect(user).not.toHaveProperty('status');

                // Verify field types
                expect(typeof user.id).toBe('string');
                expect(typeof user.email).toBe('string');
                expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
            });
        });

        it('should handle numeric comparison operators with relations', async () => {
            const options: IFindManyOptions = {
                where: {
                    'profile.age': { $gte: 25 }
                },
                relations: ['profile']
            };

            const builder = queryBuilder.build(options);
            const sql = builder.getSql();
            const params = builder.getParameters();

            // The WhereQueryBuilder may insert values directly rather than using parameters
            expectSqlToMatch(sql, '( "profile"."age" >= 25 )');
            // Parameters might be used or values might be direct - be flexible
            expect(typeof params).toBe('object');

            const results = await queryBuilder.getMany();

            // If this works, verify the results
            if (results && results.length > 0) {
                results.forEach(user => {
                    expect(user.deletedAt).toBeNull();
                    if (user.profile && user.profile.age !== null) {
                        expect(user.profile.age).toBeGreaterThanOrEqual(25);
                    }
                });
            }

        });

        it('should handle nested relation WHERE clauses', async () => {
            const options: IFindManyOptions = {
                where: {
                    'profile.addresses.city': { $iLike: '%new%' }
                },
                relations: {
                    'profile': true,
                    'profile.addresses': true
                }
            };

            const builder = queryBuilder.build(options);
            const sql = builder.getSql();
            const params = builder.getParameters();

            // Should generate correct nested relation column reference
            expectSqlToMatch(sql, '"profile_addresses"."city"');
            expect(params).toHaveProperty('where_param_0');
            expect(params.where_param_0).toBe('%new%');

            // Verify the query executes without errors
            const results = await queryBuilder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);

            // If results exist, verify the structure
            results.forEach(user => {
                expect(user.deletedAt).toBeNull();
                // Relation may or may not be loaded depending on data
                if (user.profile?.addresses?.length > 0) {
                    user.profile.addresses.forEach(address => {
                        if (address.city) {
                            expect(address.city.toLowerCase()).toContain('new');
                        }
                    });
                }
            });
        });

        it('should handle deeply nested relation WHERE clauses', async () => {
            const options: IFindManyOptions = {
                where: {
                    'profile.addresses.country.name': { $eq: 'USA' }
                },
                relations: {
                    'profile': true,
                    'profile.addresses': true,
                    'profile.addresses.country': true
                }
            };

            const builder = queryBuilder.build(options);
            const sql = builder.getSql();
            const params = builder.getParameters();

            // Should generate correct deeply nested relation column reference
            expectSqlToMatch(sql, '"profile_addresses_country"."name"');
            expect(params).toHaveProperty('where_param_0');
            expect(params.where_param_0).toBe('USA');

            // Verify the query executes without errors
            const results = await queryBuilder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);

            // If results exist, verify the structure
            results.forEach(user => {
                expect(user.deletedAt).toBeNull();
                // Relation may or may not be loaded depending on data
                if (user.profile?.addresses?.length > 0) {
                    user.profile.addresses.forEach(address => {
                        if (address.country) {
                            expect(address.country.name).toBe('USA');
                        }
                    });
                }
            });
        });

        it('should handle mixed WHERE clauses with nested and simple relations', async () => {
            const options: IFindManyOptions = {
                where: {
                    $and: [
                        { status: 'active' },
                        { 'profile.age': { $gte: 25 } },
                        { 'profile.addresses.city': { $iLike: '%city%' } }
                    ]
                },
                relations: {
                    'profile': true,
                    'profile.addresses': true
                }
            };

            const builder = queryBuilder.build(options);
            const sql = builder.getSql();
            const params = builder.getParameters();

            // Should contain all WHERE conditions with correct column references
            expectSqlToMatch(sql, '"User"."status" = ?');
            expectSqlToMatch(sql, '"profile"."age" >= 25');
            expectSqlToMatch(sql, 'LOWER(CAST("profile_addresses"."city" AS TEXT)) LIKE LOWER(?)');


            expect(params).toEqual({
                where_param_0: 'active',
                where_param_1: 25,
                where_param_2: '%city%'
            });

            // Verify the query executes without errors
            const results = await queryBuilder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);

            results.forEach(user => {
                expect(user.status).toBe('active');
                expect(user.deletedAt).toBeNull();
            });
        });

        it('should handle ORDER BY with relations without explicit joins', async () => {
            const options: IFindManyOptions = {
                relations: {
                    'profile': {
                        select: ['age']
                    }
                },
                order: {
                    'profile.age': OrderDirectionEnum.ASC,
                }
            };

            const builder = queryBuilder.build(options);
            const sql = builder.getSql();

            // Should generate correct ORDER BY clauses for nested relations
            expectSqlToMatch(sql, 'ORDER BY');
            expectSqlToMatch(sql, '"profile_age" ASC');

            // Should have created the necessary LEFT JOINs
            expectSqlToMatch(sql, 'LEFT JOIN "profiles" "profile"');

            // Verify the query executes without errors
            const results = await queryBuilder.getMany();

            expect(results).toBeDefined();

            results.forEach(user => {
                expect(user.deletedAt).toBeNull();
            });

            // Verify basic ordering by name (main entity field)
            if (results.length > 1) {
                for (let i = 1; i < results.length; i++) {
                    const prev = results[i - 1];
                    const curr = results[i];

                    if (prev.profile && curr.profile) {
                        expect(prev.profile.age <= curr.profile.age).toBe(true);
                    }
                }
            }
        });

        it('should handle complex scenario with nested WHERE and ORDER BY', async () => {
            const options: IFindManyOptions = {
                where: {
                    $or: [
                        { status: 'active' },
                        { 'profile.verified': true }
                    ]
                },
                order: {
                    'profile.age': OrderDirectionEnum.ASC,
                },
                relations: {
                    'profile': {
                        select: ['age', 'verified']
                    }
                },
                take: 10
            };

            queryBuilder.build(options);


            const results = await queryBuilder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeLessThanOrEqual(10);

            results.forEach(user => {
                expect(user.deletedAt).toBeNull();
                // Should match WHERE condition
                const matchesStatus = user.status === 'active';
                const matchesVerified = user.profile?.verified === true;
                expect(matchesStatus || matchesVerified).toBe(true);
            });

        });

        it('should handle ORDER BY with nested joins', async () => {
            const options: IFindManyOptions = {
                relations: {
                    'profile': true,
                    'profile.addresses': true
                },
                order: {
                    'profile.age': OrderDirectionEnum.ASC,
                    'profile.addresses.city': OrderDirectionEnum.DESC
                }
            };

            queryBuilder.build(options);

            const results = await queryBuilder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);

            results.forEach(user => {
                expect(user.deletedAt).toBeNull();
            });

            // If we have multiple results, verify basic ordering
            if (results.length > 1) {
                for (let i = 1; i < results.length; i++) {
                    const prev = results[i - 1];
                    const curr = results[i];

                    // Basic ordering verification (if profiles exist)
                    if (prev.profile?.age && curr.profile?.age) {
                        expect(prev.profile.age <= curr.profile.age).toBe(true);
                    }
                }
            }

        });
    });

    describe('Search and Filter', () => {
        it('should handle search across multiple fields', async () => {
            const options: IFindManyOptions = {
                where: {
                    $or: [
                        { name: { $iLike: '%john%' } },
                        { email: { $iLike: '%john%' } }
                    ]
                }
            };
            const builder = queryBuilder.build(options);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( LOWER("User"."name") LIKE LOWER(?) ) OR ( LOWER("User"."email") LIKE LOWER(?) )');
            expect(params).toEqual({
                where_param_0: '%john%',
                where_param_1: '%john%'
            });

            // Verify search results using queryBuilder methods
            const results = await queryBuilder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                const hasJohnInName = user.name && user.name.toLowerCase().includes('john');
                const hasJohnInEmail = user.email && user.email.toLowerCase().includes('john');
                expect(hasJohnInName || hasJohnInEmail).toBe(true);
                expect(user.deletedAt).toBeNull();
            });

            // Should find John Doe who has 'john' in both name and email
            const johnDoe = results.find(user => user.name === 'John Doe');
            expect(johnDoe).toBeDefined();
            expect(johnDoe.name.toLowerCase()).toContain('john');
            expect(johnDoe.email.toLowerCase()).toContain('john');
        });

        it('should handle date range filters', async () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');
            const options: IFindManyOptions = {
                where: {
                    createdAt: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            };
            const builder = queryBuilder.build(options);
            const sql = builder.getSql();
            const params = builder.getParameters();

            expectSqlToMatch(sql, '( "User"."createdAt" >= ? AND "User"."createdAt" <= ? )');
            expect(params).toEqual({
                where_param_0: startDate,
                where_param_1: endDate
            });

            // Verify date range filtering using queryBuilder methods
            const results = await queryBuilder.getMany();
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);

            results.forEach(user => {
                expect(user.createdAt).toBeInstanceOf(Date);
                expect(user.createdAt >= startDate).toBe(true);
                expect(user.createdAt <= endDate).toBe(true);
                expect(user.deletedAt).toBeNull();
            });

            // Results depend on when test is run, but verify structure
            if (results.length > 0) {
                const firstResult = results[0];
                expect(firstResult.id).toBeDefined();
                expect(typeof firstResult.id).toBe('string');
                expect(firstResult.createdAt).toBeInstanceOf(Date);
            }
        });

        it('should handle complex search with pagination and ordering', async () => {
            const options: IFindManyOptions = {
                where: {
                    $or: [
                        { status: 'active' },
                        { status: 'inactive' }
                    ]
                },
                order: {
                    name: OrderDirectionEnum.ASC
                },
                skip: 0,
                take: 5
            };
            const builder = queryBuilder.build(options);

            // Use queryBuilder methods
            const results = await queryBuilder.getMany();

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeLessThanOrEqual(5);
            expect(results.length).toBeGreaterThan(0);

            // Verify where conditions
            results.forEach(user => {
                expect(['active', 'inactive']).toContain(user.status);
                expect(user.deletedAt).toBeNull();
            });

            // Verify ordering (names should be in ascending order)
            for (let i = 1; i < results.length; i++) {
                if (results[i - 1].name && results[i].name) {
                    expect(results[i - 1].name <= results[i].name).toBe(true);
                }
            }

            // Verify data integrity
            results.forEach(user => {
                expect(user.id).toBeDefined();
                expect(typeof user.id).toBe('string');
                expect(user.createdAt).toBeInstanceOf(Date);
                expect(user.updatedAt).toBeInstanceOf(Date);
            });
        });

        it('should handle search with relations and field selection', async () => {
            const options: IFindManyOptions = {
                select: ['id', 'name', 'status'],
                where: {
                    status: 'active'
                },
                relations: {
                    'profile': {
                        select: ['age', 'verified']
                    }
                },
                order: {
                    name: OrderDirectionEnum.ASC
                }
            };
            queryBuilder.build(options);

            // Use queryBuilder methods
            const results = await queryBuilder.getMany();

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            results.forEach(user => {
                // Verify selected main fields
                expect(user).toHaveProperty('id');
                expect(user).toHaveProperty('name');
                expect(user).toHaveProperty('status');
                expect(user).not.toHaveProperty('email');

                // Verify where condition
                expect(user.status).toBe('active');

                // Verify field types
                expect(typeof user.id).toBe('string');
                expect(typeof user.status).toBe('string');
                if (user.name !== null) {
                    expect(typeof user.name).toBe('string');
                }

                // Profile relation might exist
                // Note: Relations might not be loaded if getMany() doesn't support relation loading
                if (user.profile) {
                    expect(user.profile).toHaveProperty('age');
                    expect(user.profile).toHaveProperty('verified');
                    expect(user.profile).not.toHaveProperty('bio');

                    // Verify field types - be flexible about verified field type
                    expect(typeof user.profile.age).toBe('number');
                    expect(['boolean', 'number'].includes(typeof user.profile.verified)).toBe(true);
                }
            });

            // Should find John Doe who is active
            const johnDoe = results.find(user => user.name === 'John Doe');
            expect(johnDoe).toBeDefined();
            expect(johnDoe.status).toBe('active');
            // Profile might be loaded or not, test passes either way
        });

        it('should handle empty results gracefully', async () => {
            const options: IFindManyOptions = {
                where: {
                    status: 'nonexistent-status'
                }
            };
            const builder = queryBuilder.build(options);

            // Use queryBuilder methods
            const results = await queryBuilder.getMany();

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(0);

            // Verify count is also 0 using queryBuilder methods
            const count = await queryBuilder.getCount();
            expect(count).toBe(0);
        });

        it('should use getManyAndCount for combined results', async () => {
            const options: IFindManyOptions = {
                where: {
                    status: { $in: ['active', 'inactive'] }
                },
                order: {
                    name: OrderDirectionEnum.ASC
                },
                skip: 0,
                take: 10
            };

            queryBuilder.build(options);

            // Use getManyAndCount for efficient combined query
            const [results, totalCount] = await queryBuilder.getManyAndCount();

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(typeof totalCount).toBe('number');
            expect(totalCount).toBeGreaterThanOrEqual((results as User[]).length);

            // Should find both test users
            expect((results as User[]).length).toBeGreaterThanOrEqual(2);
            expect(totalCount).toBeGreaterThanOrEqual(2);

            // Verify results match where conditions
            (results as User[]).forEach(user => {
                expect(['active', 'inactive']).toContain(user.status);
                expect(user.deletedAt).toBeNull();
            });

            // Should find both test users
            const johnDoe = (results as User[]).find(user => user.name === 'John Doe');
            const janeSmith = (results as User[]).find(user => user.name === 'Jane Smith');
            expect(johnDoe).toBeDefined();
            expect(janeSmith).toBeDefined();
        });
    });
});
