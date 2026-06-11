import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '@ackplus/nest-crud';
import { Post } from './post.entity';

@Entity('comments')
export class Comment extends BaseEntity {
  @ApiProperty({ description: 'Comment text', example: 'Great post!' })
  @Column('text')
  text: string;

  @ApiProperty({ description: 'Comment author name', example: 'Jane' })
  @Column()
  authorName: string;

  @ApiProperty({ description: 'Number of likes', example: 3, default: 0 })
  @Column({ default: 0 })
  likes: number;

  @ApiProperty({ description: 'Owning post id', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @Column({ nullable: true })
  postId: string;

  @ManyToOne(() => Post, (post) => post.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Post;
}
