import { Module, Injectable } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags } from '@nestjs/swagger';
import { Crud, CrudService } from '@ackplus/nest-crud';
import { Task } from '../database/entities/task.entity';

@Injectable()
export class TaskService extends CrudService<Task> {
  constructor(@InjectRepository(Task) public repository: Repository<Task>) {
    super(repository);
  }
}

@ApiTags('tasks')
@Crud({
  entity: Task,
  path: 'tasks',
  softDelete: true,
  routes: {
    findMany: { enabled: true },
    findAll: { enabled: true },
    findOne: { enabled: true },
    create: { enabled: true },
    createMany: { enabled: true },
    update: { enabled: true },
    delete: { enabled: true },
    deleteMany: { enabled: true },
    reorder: { enabled: true },
  },
})
export class TaskController {
  constructor(public service: TaskService) {}
}

@Module({
  imports: [TypeOrmModule.forFeature([Task])],
  controllers: [TaskController],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
