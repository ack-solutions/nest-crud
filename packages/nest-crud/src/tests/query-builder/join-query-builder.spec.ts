import { DataSource, Repository } from 'typeorm';
import { JoinQueryBuilder } from '../../lib/helper/join-query-builder';
import { User } from '../helper/entities/user-test.entity';
import { createCrudTestApp } from '../helper/testing-module';
import { INestApplication } from '@nestjs/common';
import { defaultTestData, seedTestData } from '../helper/seed-data';
import { RelationOptions } from '../../lib/types';
import { QueryBuilderHelper } from '../../lib/helper/query-builder-helper';
import { expectSqlToMatch } from '../helper/test-utils';
import { FindQueryBuilder } from '../../lib/helper/find-query-builder';

describe('JoinQueryBuilder - Integration Tests', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let userRepository: Repository<User>;
    let findQueryBuilder: FindQueryBuilder<User>;

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

        findQueryBuilder = new FindQueryBuilder(userRepository);
    });

    afterAll(async () => {
        await app.close();
    });

    describe('Simple Joins', () => {
        it('should handle simple relation joins', () => {
            const relations: RelationOptions = ['profile', 'posts'];
            const builder = findQueryBuilder.build({ relations });
            const sql = builder.getSql();

            expect(sql).toContain('LEFT JOIN "profiles" "profile"');
            expect(sql).toContain('LEFT JOIN "posts" "posts"');
        });

        it('should handle single relation with select', () => {
            const relations: RelationOptions = {
                'profile': {
                    select: ['age', 'verified']
                }
            };
            findQueryBuilder.build({ relations });
            const sql = findQueryBuilder.getBuilder().getQuery();

            expect(sql).toContain('"profile"."age"');
            expect(sql).toContain('"profile"."verified"');
            expect(sql).not.toContain('"profile"."bio"');

            expect(sql).toContain('LEFT JOIN "profiles" "profile"');
        });
    });

    describe('Nested Joins', () => {
        it('should handle nested relation joins', () => {
            const relations: RelationOptions = {
                'profile': {
                    select: ['age']
                },
                'profile.addresses': {
                    select: ['city', 'country']
                },
                'profile.addresses.country': {
                    select: ['name', 'code']
                }
            };
            findQueryBuilder.build({ relations });
            const sql = findQueryBuilder.getBuilder().getQuery();

            // Check that all three levels of joins are created
            expectSqlToMatch(sql, 'LEFT JOIN "profiles" "profile"');
            expectSqlToMatch(sql, 'LEFT JOIN "profile_addresses" "profile_addresses"');
            expectSqlToMatch(sql, 'LEFT JOIN "countries" "profile_addresses_country"');

            // check profile columns are selected
            expect(sql).toContain('"profile"."age"');
            expect(sql).not.toContain('"profile"."bio"');
            expect(sql).not.toContain('"profile"."verified"');

            // check address columns are selected
            expect(sql).toContain('"profile_addresses"."city"');
            expect(sql).not.toContain('"profile_addresses"."state"');
            expect(sql).not.toContain('"profile_addresses"."postalCode"');

            // check country columns are selected
            expect(sql).toContain('"profile_addresses_country"."name"');
            expect(sql).toContain('"profile_addresses_country"."code"');
        });

        it('should handle multiple nested relations', () => {
            const relations: RelationOptions = {
                'profile': {
                    select: ['age']
                },
                'profile.addresses': {
                    select: ['city']
                },
                'posts': {
                    select: ['title']
                },
                'posts.comments': {
                    select: ['content']
                }
            };
            findQueryBuilder.build({ relations });
            const [query] = findQueryBuilder.getBuilder().getQueryAndParameters();

            // check profile columns are selected
            expectSqlToMatch(query, 'LEFT JOIN "profiles" "profile"');
            expect(query).toContain('"profile"."age"');
            expect(query).not.toContain('"profile"."bio"');
            expect(query).not.toContain('"profile"."verified"');

            // check address columns are selected
            expectSqlToMatch(query, 'LEFT JOIN "profile_addresses" "profile_addresses"');
            expect(query).toContain('"profile_addresses"."city"');
            expect(query).not.toContain('"profile_addresses"."country"');
            expect(query).not.toContain('"profile_addresses"."state"');

            // check posts columns are selected
            expectSqlToMatch(query, 'LEFT JOIN "posts" "posts"');
            expect(query).toContain('"posts"."title"');
            expect(query).not.toContain('"posts"."content"');

            // check comments columns are selected
            expectSqlToMatch(query, 'LEFT JOIN "comments" "posts_comments"');
            expect(query).toContain('"posts_comments"."content"');
            expect(query).not.toContain('"posts_comments"."rating"');
        });
    });


    describe('Join Types', () => {
        it('should handle inner joins', () => {
            const relations: RelationOptions = {
                'profile': {
                    joinType: 'inner',
                    select: ['age']
                }
            };
            findQueryBuilder.build({ relations });
            const sql = findQueryBuilder.getBuilder().getQuery();

            expectSqlToMatch(sql, 'INNER JOIN "profiles" "profile"');
            expect(sql).not.toContain('"profile"."bio"');
            expect(sql).toContain('"profile"."age"');
        });

        it('should handle mixed join types', () => {
            const relations: RelationOptions = {
                'profile': {
                    joinType: 'inner',
                    select: ['age']
                },
                'posts': {
                    joinType: 'left',
                    select: ['title']
                }
            };
            findQueryBuilder.build({ relations });
            const sql = findQueryBuilder.getBuilder().getQuery();

            expect(sql).toContain('INNER JOIN "profiles" "profile"');
            expect(sql).not.toContain('"profile"."bio"');
            expect(sql).toContain('"profile"."age"');

            expect(sql).toContain('LEFT JOIN "posts" "posts"');
            expect(sql).toContain('"posts"."title"');
            expect(sql).not.toContain('"posts"."content"');
        });
    });

    describe('Join Alias Management', () => {
        it('should generate unique aliases for nested relations', () => {
            const relations: RelationOptions = {
                'profile': {
                    select: ['age']
                },
                'profile.addresses': {
                    select: ['city']
                },
                'profile.addresses.country': {
                    select: ['name']
                }
            };
            findQueryBuilder.build({ relations });
            const sql = findQueryBuilder.getBuilder().getQuery();

            expect(sql).toContain('LEFT JOIN "profiles" "profile"');
            expect(sql).toContain('LEFT JOIN "profile_addresses" "profile_addresses"');
            expect(sql).toContain('LEFT JOIN "countries" "profile_addresses_country"');
        });

        it('should reuse existing join aliases', () => {
            const relations: RelationOptions = {
                'profile': {
                    select: ['age']
                },
                'profile.addresses': {
                    select: ['city', 'country']
                }
            };
            const builder = findQueryBuilder.build({ relations });
            const sql = builder.getSql();

            // Should not create duplicate joins
            const joinCount = (sql.match(/LEFT JOIN "profile_addresses" "profile_addresses"/g) || []).length;
            expect(joinCount).toBe(1);
        });
    });
});
