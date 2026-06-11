import { Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Crud } from '@ackplus/nest-crud';
import { Post } from '../database/entities/post.entity';
import { PostService } from './post.service';

@ApiTags('posts')
@Crud({
  entity: Post,
  path: 'posts',
  // `internalNotes` is hidden on the entity via @CrudHidden().
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
export class PostController {
  constructor(public service: PostService) {}

  // Custom endpoints
  @Get('published')
  @ApiOperation({ 
    summary: 'Get all published posts',
    description: 'Returns all posts where published is true, including author information'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of published posts',
    type: [Post]
  })
  async getPublishedPosts(): Promise<Post[]> {
    return this.service.findPublishedPosts();
  }

  @Get('author/:authorId')
  @ApiOperation({ 
    summary: 'Get posts by author',
    description: 'Returns all posts created by the specified author'
  })
  @ApiParam({
    name: 'authorId',
    description: 'Author ID (User UUID)',
    type: String,
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6'
  })
  @ApiResponse({
    status: 200,
    description: 'List of posts by the specified author',
    type: [Post]
  })
  async getPostsByAuthor(
    @Param('authorId', ParseUUIDPipe) authorId: string,
  ): Promise<Post[]> {
    return this.service.findByAuthor(authorId);
  }

  @Get('status/:status')
  @ApiOperation({ 
    summary: 'Get posts by status',
    description: 'Returns all posts with the specified status'
  })
  @ApiParam({ 
    name: 'status', 
    description: 'Post status (e.g., draft, published)',
    example: 'draft'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of posts with the specified status',
    type: [Post]
  })
  async getPostsByStatus(@Param('status') status: string): Promise<Post[]> {
    return this.service.findByStatus(status);
  }
}

