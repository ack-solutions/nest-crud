// seeder.config.ts - Configuration for nest-seed CLI
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './src/database/entities/user.entity';
import { Post } from './src/database/entities/post.entity';
import { UserSeeder } from './src/database/seeders/user.seeder';
import { PostSeeder } from './src/database/seeders/post.seeder';

export default {
  imports: [
    // Database configuration
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'database.sqlite',
      entities: [User, Post],
      synchronize: true,
      logging: false,
    }),
    
    // Entity repositories
    TypeOrmModule.forFeature([User, Post]),
  ],
  
  // Seeders to run (in order)
  seeders: [
    UserSeeder,  // Run first
    PostSeeder,  // Run second (depends on users)
  ],
};

