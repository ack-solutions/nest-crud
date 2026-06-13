import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService, IFindManyOptions } from '@ackplus/nest-crud';
import { User } from '../database/entities/user.entity';

@Injectable()
export class UserService extends CrudService<User> {
  constructor(
    @InjectRepository(User)
    public repository: Repository<User>,
  ) {
    super(repository);
  }

  // Custom methods
  async findActiveUsers(): Promise<User[]> {
    return this.repository.find({
      where: { isActive: true },
      relations: ['posts'],
    });
  }

  async findByRole(role: string): Promise<User[]> {
    return this.repository.find({
      where: { role },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({
      where: { email },
    });
  }

  /**
   * Stream every matching user one-by-one, reusing the SAME query as findMany
   * (where / relations / order / select / soft-delete flags).
   *
   * It pages in batches and yields each row, so the whole result set is never held
   * in memory at once — a 1,000- or 1,000,000-row export stays memory-safe. Because
   * it goes through findMany(), it also reuses hidden-field stripping, relation
   * hydration, and the beforeFindMany hook.
   */
  async *exportAll(query: IFindManyOptions = {}, batchSize = 100): AsyncIterable<User> {
    let skip = 0;
    for (;;) {
      const { items } = await this.findMany({ ...query, take: batchSize, skip });
      if (items.length === 0) break;
      for (const user of items) yield user; // one by one
      if (items.length < batchSize) break; // last page
      skip += batchSize;
    }
  }
}

