import { DataFactory } from '@ackplus/nest-crud';
import { UserFactory } from '../factories/user.factory';
import { PostFactory } from '../factories/post.factory';

describe('Factories', () => {
  describe('UserFactory', () => {
    let factory: any;

    beforeEach(() => {
      factory = DataFactory.createForClass(UserFactory);
    });

    it('should create a factory', () => {
      expect(factory).toBeDefined();
      expect(factory.generate).toBeDefined();
    });

    it('should generate single user', () => {
      const users = factory.generate(1);
      
      expect(users).toHaveLength(1);
      expect(users[0]).toHaveProperty('email');
      expect(users[0]).toHaveProperty('firstName');
      expect(users[0]).toHaveProperty('lastName');
      expect(users[0]).toHaveProperty('password');
      expect(users[0]).toHaveProperty('isActive');
      expect(users[0]).toHaveProperty('role');
    });

    it('should generate multiple users', () => {
      const count = 10;
      const users = factory.generate(count);
      
      expect(users).toHaveLength(count);
    });

    it('should generate users with valid email format', () => {
      const users = factory.generate(5);
      
      users.forEach(user => {
        expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      });
    });

    it('should generate users with different data', () => {
      const users = factory.generate(5);
      
      const emails = new Set(users.map(u => u.email));
      expect(emails.size).toBeGreaterThan(1); // Should have at least some unique emails
    });

    it('should generate users with valid role', () => {
      const users = factory.generate(10);
      const validRoles = ['user', 'admin', 'moderator'];
      
      users.forEach(user => {
        expect(validRoles).toContain(user.role);
      });
    });

    it('should override values when provided', () => {
      const customEmail = 'custom@example.com';
      const users = factory.generate(3, { email: customEmail });
      
      users.forEach(user => {
        expect(user.email).toBe(customEmail);
      });
    });

    it('should partially override values', () => {
      const customRole = 'admin';
      const users = factory.generate(3, { role: customRole });
      
      users.forEach(user => {
        expect(user.role).toBe(customRole);
        expect(user.email).toBeDefined(); // Other fields still generated
        expect(user.firstName).toBeDefined();
      });
    });

    it('should generate boolean for isActive field', () => {
      const users = factory.generate(10);
      
      users.forEach(user => {
        expect(typeof user.isActive).toBe('boolean');
      });
    });

    it('should generate password with minimum length', () => {
      const users = factory.generate(5);
      
      users.forEach(user => {
        expect(user.password.length).toBeGreaterThan(0);
      });
    });
  });

  describe('PostFactory', () => {
    let factory: any;

    beforeEach(() => {
      factory = DataFactory.createForClass(PostFactory);
    });

    it('should create a factory', () => {
      expect(factory).toBeDefined();
      expect(factory.generate).toBeDefined();
    });

    it('should generate single post', () => {
      const posts = factory.generate(1, { authorId: 1 });
      
      expect(posts).toHaveLength(1);
      expect(posts[0]).toHaveProperty('title');
      expect(posts[0]).toHaveProperty('content');
      expect(posts[0]).toHaveProperty('status');
      expect(posts[0]).toHaveProperty('viewCount');
      expect(posts[0]).toHaveProperty('published');
    });

    it('should generate multiple posts', () => {
      const count = 10;
      const posts = factory.generate(count, { authorId: 1 });
      
      expect(posts).toHaveLength(count);
    });

    it('should generate posts with valid status', () => {
      const posts = factory.generate(10, { authorId: 1 });
      const validStatuses = ['draft', 'published', 'archived'];
      
      posts.forEach(post => {
        expect(validStatuses).toContain(post.status);
      });
    });

    it('should generate posts with numeric viewCount', () => {
      const posts = factory.generate(5, { authorId: 1 });
      
      posts.forEach(post => {
        expect(typeof post.viewCount).toBe('number');
        expect(post.viewCount).toBeGreaterThanOrEqual(0);
        expect(post.viewCount).toBeLessThanOrEqual(1000);
      });
    });

    it('should generate posts with boolean published field', () => {
      const posts = factory.generate(5, { authorId: 1 });
      
      posts.forEach(post => {
        expect(typeof post.published).toBe('boolean');
      });
    });

    it('should accept authorId override', () => {
      const authorId = 42;
      const posts = factory.generate(3, { authorId });
      
      posts.forEach(post => {
        expect(post.authorId).toBe(authorId);
      });
    });

    it('should generate different content for each post', () => {
      const posts = factory.generate(5, { authorId: 1 });
      
      const titles = new Set(posts.map(p => p.title));
      const contents = new Set(posts.map(p => p.content));
      
      expect(titles.size).toBeGreaterThan(1);
      expect(contents.size).toBeGreaterThan(1);
    });
  });

  describe('Factory edge cases', () => {
    it('should handle generating zero items', () => {
      const factory = DataFactory.createForClass(UserFactory);
      const users = factory.generate(0);
      
      expect(users).toHaveLength(0);
      expect(Array.isArray(users)).toBe(true);
    });

    it('should handle large batch generation', () => {
      const factory = DataFactory.createForClass(UserFactory);
      const count = 100;
      const users = factory.generate(count);
      
      expect(users).toHaveLength(count);
    });

    it('should maintain type consistency across generations', () => {
      const factory = DataFactory.createForClass(UserFactory);
      const batch1 = factory.generate(5);
      const batch2 = factory.generate(5);
      
      const keys1 = Object.keys(batch1[0]).sort();
      const keys2 = Object.keys(batch2[0]).sort();
      
      expect(keys1).toEqual(keys2);
    });
  });
});

