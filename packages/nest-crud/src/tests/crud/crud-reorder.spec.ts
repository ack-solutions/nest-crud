import { INestApplication, Injectable, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';

import { Crud } from '../../lib/decorator/crud.decorator';
import { CrudService } from '../../lib/service/crud-service';
import { OrderedItem } from '../helper/entities/ordered-item-test.entity';

@Injectable()
class OrderedItemService extends CrudService<OrderedItem> {
    constructor(@InjectRepository(OrderedItem) public repository: Repository<OrderedItem>) {
        super(repository);
    }
}

@Crud({
    entity: OrderedItem,
    path: 'items',
    routes: {
        create: { enabled: true },
        findMany: { enabled: true },
        reorder: { enabled: true },
    },
})
class OrderedItemController {
    constructor(public service: OrderedItemService) {}
}

/**
 * HTTP reorder regression guard. The route handler must unwrap the validated DTO
 * (`{ ids: [...] }`) before calling `service.reorder(ids)` — otherwise the whole
 * object is passed where an array is expected and nothing is reordered.
 */
describe('reorder (HTTP)', () => {
    let app: INestApplication;
    const http = () => request(app.getHttpServer());

    beforeAll(async () => {
        const moduleRef: TestingModule = await Test.createTestingModule({
            imports: [
                TypeOrmModule.forRoot({ type: 'sqljs', autoSave: false, entities: [OrderedItem], synchronize: true, logging: false } as any),
                TypeOrmModule.forFeature([OrderedItem]),
            ],
            controllers: [OrderedItemController],
            providers: [OrderedItemService],
        }).compile();

        app = moduleRef.createNestApplication();
        app.useGlobalPipes(new ValidationPipe());
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('PUT /items/reorder persists the new order from { ids }', async () => {
        const a = (await http().post('/items').send({ name: 'a' }).expect(201)).body;
        const b = (await http().post('/items').send({ name: 'b' }).expect(201)).body;
        const c = (await http().post('/items').send({ name: 'c' }).expect(201)).body;

        const res = await http().put('/items/reorder').send({ ids: [c.id, a.id, b.id] }).expect(200);
        expect(res.body).toEqual({ success: true, message: expect.any(String) });

        const list = await http().get('/items').query({ order: JSON.stringify({ order: 'ASC' }) }).expect(200);
        expect(list.body.items.map((i: any) => i.name)).toEqual(['c', 'a', 'b']);
        expect(list.body.items.map((i: any) => i.order)).toEqual([0, 1, 2]);
    });

    it('rejects a body without ids (validation)', async () => {
        await http().put('/items/reorder').send({}).expect(400);
    });
});
