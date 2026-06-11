import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';

import { createCrudTestApp } from '../helper/testing-module';
import { User } from '../helper/entities/user-test.entity';

/**
 * Contract test over the generated OpenAPI document. Guards against silent
 * Swagger-metadata regressions on version bumps.
 */
describe('Swagger contract', () => {
    let app: INestApplication;
    let doc: OpenAPIObject;

    beforeAll(async () => {
        app = await createCrudTestApp({
            entity: User,
            path: 'users',
            routes: {
                findMany: { enabled: true },
                findOne: { enabled: true },
                create: { enabled: true },
                createMany: { enabled: true },
                update: { enabled: true },
                delete: { enabled: true },
                deleteMany: { enabled: true },
            },
        });
        const config = new DocumentBuilder().setTitle('test').setVersion('1.0').build();
        doc = SwaggerModule.createDocument(app, config);
    });

    afterAll(async () => {
        await app.close();
    });

    it('documents the generated paths and verbs', () => {
        expect(doc.paths['/users'].get).toBeDefined();        // findMany
        expect(doc.paths['/users'].post).toBeDefined();       // create
        expect(doc.paths['/users/bulk'].post).toBeDefined();  // createMany
        expect(doc.paths['/users/{id}'].get).toBeDefined();   // findOne
        expect(doc.paths['/users/{id}'].put).toBeDefined();   // update
        expect(doc.paths['/users/{id}'].delete).toBeDefined(); // delete
    });

    it('assigns an operationId to every generated operation', () => {
        expect(doc.paths['/users'].get.operationId).toBeTruthy();
        expect(doc.paths['/users'].post.operationId).toBeTruthy();
        expect(doc.paths['/users/{id}'].put.operationId).toBeTruthy();
    });

    it('documents success and error responses', () => {
        expect(doc.paths['/users'].get.responses['200']).toBeDefined();
        expect(doc.paths['/users'].post.responses['201']).toBeDefined();
        expect(doc.paths['/users/{id}'].get.responses['404']).toBeDefined();
    });

    it('registers the reusable response/error DTOs as components', () => {
        const schemas = doc.components?.schemas ?? {};
        expect(Object.keys(schemas)).toEqual(
            expect.arrayContaining(['ErrorResponseDto', 'PaginationResponseDto']),
        );
    });

    it('exposes findMany query parameters (incl. aggregates/having) with examples and no duplicates', () => {
        const allParams = (doc.paths['/users'].get.parameters ?? []) as any[];
        const names = allParams.map((p) => p.name);

        expect(names).toEqual(
            expect.arrayContaining(['where', 'relations', 'order', 'select', 'aggregates', 'having', 'take', 'skip', 'withDeleted', 'onlyDeleted']),
        );

        // No duplicate query-param names in the generated document.
        const queryNames = allParams.filter((p) => p.in === 'query').map((p) => p.name);
        expect(queryNames.length).toBe(new Set(queryNames).size);

        // Examples are present so "Try it out" is usable.
        const where = allParams.find((p) => p.name === 'where');
        expect(where.examples ?? where.example ?? where.schema?.example).toBeTruthy();
        const aggregates = allParams.find((p) => p.name === 'aggregates');
        expect(aggregates.examples ?? aggregates.example ?? aggregates.schema?.example).toBeTruthy();

        // JSON-encoded params must be documented as `type: string`, NOT object/array —
        // otherwise Swagger UI's "Try it out" rejects the value with "must be valid JSON".
        for (const name of ['where', 'relations', 'order', 'select', 'aggregates', 'having']) {
            const p = allParams.find((x) => x.name === name);
            const schema = p.schema ?? {};
            expect(schema.type).toBe('string');
            expect(schema.oneOf ?? schema.anyOf).toBeUndefined();
        }
    });

    it('documents the id path param as a uuid', () => {
        const params = (doc.paths['/users/{id}'].get.parameters ?? []) as any[];
        const idParam = params.find((p) => p.name === 'id');
        expect(idParam).toBeDefined();
        expect(idParam.schema?.format ?? idParam.format).toBe('uuid');
    });

    it('create request body omits server-managed fields', () => {
        const reqSchema: any = doc.paths['/users'].post.requestBody?.['content']?.['application/json']?.schema;
        expect(reqSchema).toBeDefined();
        const ref: string | undefined = reqSchema.$ref;
        const schemaName = ref ? ref.split('/').pop() : undefined;
        const schema = schemaName ? (doc.components?.schemas as any)?.[schemaName] : reqSchema;
        const props = Object.keys(schema?.properties ?? {});
        expect(props).not.toContain('id');
        expect(props).not.toContain('createdAt');
        expect(props).not.toContain('deletedAt');
    });
});
