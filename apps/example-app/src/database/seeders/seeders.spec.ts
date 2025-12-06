import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../database/entities/user.entity';
import { Post } from '../database/entities/post.entity';
import { UserSeeder } from '../database/seeders/user.seeder';
import { PostSeeder } from '../database/seeders/post.seeder';
import { SeederServiceOptions } from '@ackplus/nest-crud';

describe('Seeders Integration Tests', () => {
  let module: TestingModule;
  let userRepository: Repository<User>;
  let postRepository: Repository<Post>;
  let userSeeder: UserSeeder;
  let postSeeder: PostSeeder;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User, Post],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([User, Post]),
      ],
      providers: [UserSeeder, PostSeeder],
    }).compile();

    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    postRepository = module.get<Repository<Post>>(getRepositoryToken(Post));
    userSeeder = module.get<UserSeeder>(UserSeeder);
    postSeeder = module.get<PostSeeder>(PostSeeder);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    // Clean up before each test
    await postRepository.delete({});
    await userRepository.delete({});
  });

  describe('UserSeeder', () => {
    it('should be defined', () => {
      expect(userSeeder).toBeDefined();
    });

    it('should seed users successfully', async () => {
      const options: SeederServiceOptions = { dummyData: false };
      
      await userSeeder.seed(options);
      
      const count = await userRepository.count();
      expect(count).toBe(10);
    });

    it('should seed 50 users with dummyData option', async () => {
      const options: SeederServiceOptions = { dummyData: true };
      
      await userSeeder.seed(options);
      
      const count = await userRepository.count();
      expect(count).toBe(50);
    });

    it('should create users with all required fields', async () => {
      const options: SeederServiceOptions = {};
      
      await userSeeder.seed(options);
      
      const users = await userRepository.find();
      expect(users.length).toBeGreaterThan(0);

      const user = users[0];
      expect(user.email).toBeDefined();
      expect(user.firstName).toBeDefined();
      expect(user.lastName).toBeDefined();
      expect(user.password).toBeDefined();
      expect(user.role).toBeDefined();
      expect(typeof user.isActive).toBe('boolean');
    });

    it('should skip seeding if users exist and refresh is false', async () => {
      // Seed first time
      await userSeeder.seed({});
      const initialCount = await userRepository.count();
      
      // Try to seed again without refresh
      await userSeeder.seed({});
      const finalCount = await userRepository.count();
      
      expect(finalCount).toBe(initialCount);
    });

    it('should drop users successfully', async () => {
      await userSeeder.seed({});
      expect(await userRepository.count()).toBeGreaterThan(0);
      
      await userSeeder.drop({});
      
      const count = await userRepository.count();
      expect(count).toBe(0);
    });

    it('should handle drop when no users exist', async () => {
      const count = await userRepository.count();
      expect(count).toBe(0);
      
      // Should not throw error
      await expect(userSeeder.drop({})).resolves.not.toThrow();
    });
  });

  describe('PostSeeder', () => {
    beforeEach(async () => {
      // Seed users first as posts depend on them
      await userSeeder.seed({});
    });

    it('should be defined', () => {
      expect(postSeeder).toBeDefined();
    });

    it('should seed posts successfully', async () => {
      const options: SeederServiceOptions = { dummyData: false };
      
      await postSeeder.seed(options);
      
      const count = await postRepository.count();
      const userCount = await userRepository.count();
      expect(count).toBe(userCount * 3); // 3 posts per user
    });

    it('should seed more posts with dummyData option', async () => {
      const options: SeederServiceOptions = { dummyData: true };
      
      await postSeeder.seed(options);
      
      const count = await postRepository.count();
      const userCount = await userRepository.count();
      expect(count).toBe(userCount * 5); // 5 posts per user with dummyData
    });

    it('should create posts with all required fields', async () => {
      await postSeeder.seed({});
      
      const posts = await postRepository.find();
      expect(posts.length).toBeGreaterThan(0);

      const post = posts[0];
      expect(post.title).toBeDefined();
      expect(post.content).toBeDefined();
      expect(post.status).toBeDefined();
      expect(post.authorId).toBeDefined();
      expect(typeof post.viewCount).toBe('number');
      expect(typeof post.published).toBe('boolean');
    });

    it('should link posts to existing users', async () => {
      await postSeeder.seed({});
      
      const posts = await postRepository.find({ relations: ['author'] });
      expect(posts.length).toBeGreaterThan(0);

      posts.forEach(post => {
        expect(post.authorId).toBeDefined();
        expect(post.author).toBeDefined();
        expect(post.author.id).toBe(post.authorId);
      });
    });

    it('should warn if no users exist', async () => {
      // Drop all users
      await userRepository.delete({});
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await postSeeder.seed({});
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No users found'));
      
      const count = await postRepository.count();
      expect(count).toBe(0);
      
      consoleSpy.mockRestore();
    });

    it('should skip seeding if posts exist and refresh is false', async () => {
      // Seed first time
      await postSeeder.seed({});
      const initialCount = await postRepository.count();
      
      // Try to seed again without refresh
      await postSeeder.seed({});
      const finalCount = await postRepository.count();
      
      expect(finalCount).toBe(initialCount);
    });

    it('should drop posts successfully', async () => {
      await postSeeder.seed({});
      expect(await postRepository.count()).toBeGreaterThan(0);
      
      await postSeeder.drop({});
      
      const count = await postRepository.count();
      expect(count).toBe(0);
    });
  });

  describe('Seeders with refresh option', () => {
    it('should drop and reseed users with refresh option', async () => {
      // Seed first time
      await userSeeder.seed({});
      const firstCount = await userRepository.count();
      
      // Seed with refresh
      await userSeeder.drop({ refresh: true });
      await userSeeder.seed({ refresh: true });
      
      const secondCount = await userRepository.count();
      expect(secondCount).toBe(firstCount);
    });

    it('should maintain referential integrity when dropping', async () => {
      // Seed users and posts
      await userSeeder.seed({});
      await postSeeder.seed({});
      
      expect(await userRepository.count()).toBeGreaterThan(0);
      expect(await postRepository.count()).toBeGreaterThan(0);
      
      // Drop in correct order (posts first, then users)
      await postSeeder.drop({});
      await userSeeder.drop({});
      
      expect(await postRepository.count()).toBe(0);
      expect(await userRepository.count()).toBe(0);
    });
  });

  describe('Specific seeder by name', () => {
    it('should handle seeder name option', async () => {
      const options: SeederServiceOptions = { name: 'UserSeeder' };
      
      await userSeeder.seed(options);
      
      const userCount = await userRepository.count();
      const postCount = await postRepository.count();
      
      expect(userCount).toBeGreaterThan(0);
      expect(postCount).toBe(0); // PostSeeder not run
    });
  });
});

