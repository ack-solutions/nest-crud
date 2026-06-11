import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('@ackplus/nest-crud Example API')
    .setDescription(
      [
        'Live demo of **@ackplus/nest-crud** — every list endpoint (`GET /users`, `GET /posts`, …)',
        'accepts `where`, `relations`, `order`, `select`, `aggregates`, `having`, `take`, `skip`,',
        '`withDeleted`, `onlyDeleted` (each documented with an example on the endpoint).',
        'Seed data is inserted on startup, so you can try things immediately.',
        '',
        '### Copy-paste examples (paste the value into the matching query field)',
        '',
        '- **Filter**: `where = {"role":"admin","age":{"$gte":30}}`',
        '- **OR / AND**: `where = {"$or":[{"role":"admin"},{"role":"moderator"}]}`',
        '- **Case-insensitive search**: `where = {"firstName":{"$iLike":"%jo%"}}`',
        '- **Relation existence**: `where = {"posts":{"$exists":true}}`',
        '- **Nested relations**: `relations = ["profile.addresses","posts.comments"]`',
        '- **Relation select + inner join**: `relations = [{"posts":{"select":["title"],"joinType":"inner"}}]`',
        '- **Select columns**: `select = ["id","firstName","email"]`',
        '- **Sort**: `order = {"age":"DESC"}`',
        '- **Aggregates**: `aggregates = [{"fn":"count","field":"posts.id","as":"postCount"},{"fn":"sum","field":"posts.likes","as":"likes"}]`',
        '- **HAVING + sort by aggregate**: with the above, `having = {"postCount":{"$gt":1}}` and `order = {"postCount":"DESC"}`',
        '- **Hidden field (dropped)**: `select = ["email","password"]` → `password` is omitted',
        '- **Hidden field (rejected)**: `where = {"password":{"$eq":"x"}}` → 400',
        '- **Hidden relation (rejected)**: `relations = ["auditLogs"]` → 400',
        '- **Trash**: `onlyDeleted = true` after you DELETE a row',
      ].join('\n')
    )
    .setVersion('2.1')
    .addTag('users', 'Users — profile (1:1), posts (1:n), hidden password + auditLogs')
    .addTag('posts', 'Posts — author (n:1), comments (1:n), hidden internalNotes')
    .addTag('profiles', 'Profiles — addresses (1:n)')
    .addTag('comments', 'Comments')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`\n🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api\n`);
}

bootstrap();
