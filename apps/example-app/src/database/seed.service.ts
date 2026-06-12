import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';

/**
 * Seeds varied demo data on startup (once) so every query feature returns
 * meaningful results: users with different roles / ages / active flags, with and
 * without posts, posts with comments, profiles with addresses, and (hidden) audit
 * logs. Relations cascade-insert from the User graph.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger('SeedService');

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    const userRepo = this.dataSource.getRepository(User);
    if ((await userRepo.count()) > 0) {
      return; // already seeded (e.g. persistent DATABASE_PATH)
    }

    const data: Array<Partial<User>> = [
      {
        email: 'john@example.com', firstName: 'John', lastName: 'Doe', age: 35,
        password: 'hash_john', isActive: true, role: 'admin',
        profile: {
          bio: 'Full-stack engineer and team lead.', website: 'https://john.dev',
          addresses: [
            { city: 'New York', state: 'NY', country: 'USA', postalCode: '10001' },
            { city: 'Boston', state: 'MA', country: 'USA', postalCode: '02108' },
          ],
        } as any,
        posts: [
          { title: 'Intro to nest-crud', content: 'Getting started…', status: 'published', likes: 30, viewCount: 900, internalNotes: 'pin to top',
            comments: [ { text: 'Super helpful!', authorName: 'Mia', likes: 5 }, { text: 'Thanks', authorName: 'Sam', likes: 2 } ] },
          { title: 'Advanced querying', content: 'Aggregates & having…', status: 'published', likes: 12, viewCount: 340,
            comments: [ { text: 'The HAVING part is gold', authorName: 'Lee', likes: 7 } ] },
          { title: 'Draft notes', content: 'WIP…', status: 'draft', likes: 5, viewCount: 120, comments: [] },
        ] as any,
        auditLogs: [ { action: 'login', ip: '203.0.113.7' } ] as any,
      },
      {
        email: 'jane@example.com', firstName: 'Jane', lastName: 'Smith', age: 28,
        password: 'hash_jane', isActive: true, role: 'user',
        profile: {
          bio: 'Designer who codes.', website: 'https://jane.design',
          addresses: [ { city: 'Mumbai', state: 'MH', country: 'India', postalCode: '400001' } ],
        } as any,
        posts: [
          { title: 'Design systems', content: 'Tokens and themes…', status: 'published', likes: 20, viewCount: 500,
            comments: [ { text: 'Love this', authorName: 'Ana', likes: 4 }, { text: 'Nice', authorName: 'Ravi', likes: 1 } ] },
        ] as any,
        auditLogs: [ { action: 'login', ip: '198.51.100.4' } ] as any,
      },
      {
        email: 'bob@example.com', firstName: 'Bob', lastName: 'Brown', age: 42,
        password: 'hash_bob', isActive: false, role: 'moderator',
        profile: {
          bio: 'Community moderator.',
          addresses: [ { city: 'London', country: 'UK', postalCode: 'EC1A' } ],
        } as any,
        posts: [
          { title: 'Moderation tips', content: 'Be kind…', status: 'published', likes: 8, viewCount: 210, comments: [ { text: 'Agreed', authorName: 'Kim', likes: 0 } ] },
          { title: 'Archived rant', content: 'Old stuff', status: 'archived', likes: 15, viewCount: 60, comments: [] },
        ] as any,
        auditLogs: [ { action: 'password_change', ip: '192.0.2.55' } ] as any,
      },
      {
        // No posts — demonstrates count = 0 and $notExists.
        email: 'alice@example.com', firstName: 'Alice', lastName: 'Green', age: 24,
        password: 'hash_alice', isActive: true, role: 'user',
        profile: {
          bio: 'New here!',
          addresses: [ { city: 'Toronto', state: 'ON', country: 'Canada', postalCode: 'M5H' } ],
        } as any,
        posts: [] as any,
        auditLogs: [ { action: 'signup', ip: '203.0.113.99' } ] as any,
      },
    ];

    for (const user of data) {
      await userRepo.save(userRepo.create(user));
    }

    this.logger.log(`Seeded ${data.length} users with profiles, posts, comments, addresses and audit logs.`);
  }
}
