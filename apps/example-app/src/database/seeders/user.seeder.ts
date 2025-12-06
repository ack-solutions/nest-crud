import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Seeder, SeederServiceOptions, DataFactory } from '@ackplus/nest-crud';
import { User } from '../entities/user.entity';
import { UserFactory } from '../factories/user.factory';

@Injectable()
export class UserSeeder implements Seeder {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async seed(options: SeederServiceOptions): Promise<void> {
    console.log('🌱 Seeding users...');

    // Check if users already exist (unless refresh mode)
    const existingCount = await this.userRepository.count();
    if (existingCount > 0 && !options.refresh) {
      console.log(`⏭️  ${existingCount} users already exist, skipping...`);
      return;
    }

    // Create factory
    const factory = DataFactory.createForClass(UserFactory);

    // Generate different amounts based on options
    const count = options.dummyData ? 50 : 10;
    
    // Generate users
    const users = factory.generate(count);

    // Insert in batches for better performance
    const batchSize = 25;
    let inserted = 0;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      await this.userRepository.save(batch);
      inserted += batch.length;
      console.log(`  📦 Inserted ${inserted}/${users.length} users`);
    }

    console.log(`✅ Successfully seeded ${users.length} users`);
  }

  async drop(options: SeederServiceOptions): Promise<void> {
    console.log('🗑️  Dropping users...');
    
    const count = await this.userRepository.count();
    if (count === 0) {
      console.log('  ℹ️  No users to drop');
      return;
    }
    
    await this.userRepository.delete({});
    console.log(`✅ Dropped ${count} users`);
  }
}

