import { Module, Injectable } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags } from '@nestjs/swagger';
import { Crud, CrudService } from '@ackplus/nest-crud';
import { Comment } from '../database/entities/comment.entity';

@Injectable()
export class CommentService extends CrudService<Comment> {
  constructor(@InjectRepository(Comment) public repository: Repository<Comment>) {
    super(repository);
  }
}

@ApiTags('comments')
@Crud({
  entity: Comment,
  path: 'comments',
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
export class CommentController {
  constructor(public service: CommentService) {}
}

@Module({
  imports: [TypeOrmModule.forFeature([Comment])],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
})
export class CommentModule {}
