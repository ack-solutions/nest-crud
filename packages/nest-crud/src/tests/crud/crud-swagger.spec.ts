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

    it('exposes findMany query parameters', () => {
        const params = (doc.paths['/users'].get.parameters ?? []).map((p: any) => p.name);
        expect(params).toEqual(expect.arrayContaining(['where', 'relations', 'take', 'withDeleted']));
    });
});
