import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

/**
 * End-to-end tests that exercise the REAL generated CRUD routes produced by the
 * `@Crud()` decorator over an in-memory SQLite database. This is the smoke test
 * that proves the example app boots and the generated endpoints register and work.
 */
describe('Example app (e2e)', () => {
  let app: INestApplication;

  const sampleUser = {
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    password: 'secret',
    role: 'admin',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / returns the welcome message', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
  });

  describe('/users generated CRUD', () => {
    let createdId: string;

    it('POST /users creates a user', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .send(sampleUser)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.email).toBe(sampleUser.email);
      createdId = res.body.id;
    });

    it('GET /users returns a paginated { items, total } envelope', async () => {
      const res = await request(app.getHttpServer()).get('/users').expect(200);

      expect(Array.isArray(res.body.items)).toBe(true);
      expect(typeof res.body.total).toBe('number');
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('GET /users/:id returns a single user', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${createdId}`)
        .expect(200);

      expect(res.body.id).toBe(createdId);
      expect(res.body.email).toBe(sampleUser.email);
    });

    it('PUT /users/:id updates a user', async () => {
      const res = await request(app.getHttpServer())
        .put(`/users/${createdId}`)
        .send({ firstName: 'Janet' })
        .expect(200);

      expect(res.body.firstName).toBe('Janet');
    });

    it('GET /users/active resolves the custom route (not findOne :id)', async () => {
      const res = await request(app.getHttpServer()).get('/users/active').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('DELETE /users/:id removes the user, then it 404s', async () => {
      await request(app.getHttpServer()).delete(`/users/${createdId}`).expect(200);
      await request(app.getHttpServer()).get(`/users/${createdId}`).expect(404);
    });
  });
});
