import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags } from '@nestjs/swagger';
import { Crud, CrudService } from '@ackplus/nest-crud';
import { Profile } from '../database/entities/profile.entity';
import { Address } from '../database/entities/address.entity';

@Injectable()
export class ProfileService extends CrudService<Profile> {
  constructor(@InjectRepository(Profile) public repository: Repository<Profile>) {
    super(repository);
  }
}

@ApiTags('profiles')
@Crud({
  entity: Profile,
  path: 'profiles',
  routes: {
    findMany: { enabled: true },
    findAll: { enabled: true },
    counts: { enabled: true },
    findOne: { enabled: true },
    create: { enabled: true },
    createMany: { enabled: true },
    update: { enabled: true },
    updateMany: { enabled: true },
    delete: { enabled: true },
    deleteMany: { enabled: true },
  },
})
export class ProfileController {
  constructor(public service: ProfileService) {}
}

@Module({
  imports: [TypeOrmModule.forFeature([Profile, Address])],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
