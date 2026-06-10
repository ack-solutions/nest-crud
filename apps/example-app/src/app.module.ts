import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { User } from './database/entities/user.entity';
import { Post } from './database/entities/post.entity';
import { UserModule } from './users/user.module';
import { PostModule } from './posts/post.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      // Reads DATABASE_PATH at init time. Defaults to an in-memory database so the
      // demo (and e2e tests) start clean with zero setup; set DATABASE_PATH to a
      // file path (e.g. database.sqlite) if you want data to persist between runs.
      useFactory: () => ({
        type: 'sqljs',
        // sql.js = pure-WASM SQLite, zero native setup. With no location it runs
        // fully in-memory; set DATABASE_PATH to a file to persist between runs.
        location: process.env.DATABASE_PATH,
        autoSave: !!process.env.DATABASE_PATH,
        entities: [User, Post],
        synchronize: true,
        logging: false,
      }),
    }),
    UserModule,
    PostModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
