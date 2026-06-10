import { INestApplication, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';

import { createCrudTestApp } from '../helper/testing-module';
import { seedTestData } from '../helper/seed-data';
import { User } from '../helper/entities/user-test.entity';
import { FindQueryBuilder } from '../../lib/helper/find-query-builder';

/**
 * Query-safety tests.
 *
 * Identifiers are quoted downstream (so a crafted key becomes a single quoted
 * identifier, not injectable SQL), but we additionally reject unknown where keys
 * with a 400 — both for a clean error and as defense-in-depth.
 */
describe('Query safety', () => {
    let app: INestApplication;
    let dataSource: DataSource;

    beforeAll(async () => {
        app = await createCrudTestApp({ entity: User, path: 'users', routes: { findMany: { enabled: true } } });
        dataSource = app.get(DataSource);
        await seedTestData(dataSource, dataSource.getRepository(User));
    });

    afterAll(async () => {
        await app.close();
    });

    const build = (options: any) => new FindQueryBuilder(dataSource.getRepository(User) as any).build(options);

    describe('where-field allowlist', () => {
        it('rejects an unknown where field', () => {
            expect(() => build({ where: { notARealColumn: { $eq: 'x' } } })).toThrow(BadRequestException);
        });

        it('rejects crafted injection-style keys', () => {
            expect(() => build({ where: { 'name) OR (1=1': { $isNull: true } } })).toThrow(BadRequestException);
            expect(() => build({ where: { 'name"; DROP TABLE users; --': { $eq: 'x' } } })).toThrow(BadRequestException);
        });

        it('allows valid columns and relation paths', () => {
            expect(() => build({ where: { name: { $eq: 'John Doe' } } })).not.toThrow();
            expect(() => build({ where: { 'profile.age': { $gte: 18 } }, relations: ['profile'] })).not.toThrow();
        });

        it('returns 400 over HTTP for an invalid filter field', async () => {
            await request(app.getHttpServer())
                .get('/users')
                .query({ where: JSON.stringify({ 'name) OR (1=1': { $isNull: true } }) })
                .expect(400);
        });

        it('does not execute injected SQL — the table survives the attempt', async () => {
            await request(app.getHttpServer())
                .get('/users')
                .query({ where: JSON.stringify({ 'name"; DROP TABLE users; --': { $eq: 'x' } }) })
                .expect(400);

            const ok = await request(app.getHttpServer()).get('/users').expect(200);
            expect(ok.body.total).toBe(2);
        });
    });

    describe('operator edge cases', () => {
        it('empty $in matches nothing', async () => {
            expect(await build({ where: { status: { $in: [] } } }).getCount()).toBe(0);
        });

        it('empty $notIn matches everything', async () => {
            expect(await build({ where: { status: { $notIn: [] } } }).getCount()).toBe(2);
        });

        it('rejects $between without a [start, end] pair', () => {
            expect(() => build({ where: { 'profile.age': { $between: 5 } }, relations: ['profile'] }))
                .toThrow(BadRequestException);
        });

        it('accepts a valid $between pair', () => {
            expect(() => build({ where: { 'profile.age': { $between: [20, 40] } }, relations: ['profile'] }))
                .not.toThrow();
        });
    });
});
