import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity, CrudHidden } from '@ackplus/nest-crud';
import { User } from './user.entity';
import { Comment } from './comment.entity';

@Entity('posts')
export class Post extends BaseEntity {
  @ApiProperty({ description: 'Post title', example: 'My First Post' })
  @Column()
  title: string;

  @ApiProperty({ description: 'Post content', example: 'This is the content of my first post...' })
  @Column('text')
  content: string;

  @ApiProperty({ description: 'Post status', example: 'published', enum: ['draft', 'published', 'archived'], default: 'draft' })
  @Column({ default: 'draft' })
  status: string;

  @ApiProperty({ description: 'Number of likes (aggregate target)', example: 12, default: 0 })
  @Column({ default: 0 })
  likes: number;

  @ApiProperty({ description: 'Number of views (aggregate target)', example: 340, default: 0 })
  @Column({ default: 0 })
  viewCount: number;

  /** Hidden column: editorial notes never exposed via CRUD queries. */
  @CrudHidden()
  @Column('text', { nullable: true })
  internalNotes: string;

  @ApiProperty({ description: 'Author id (User UUID)', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @Column({ nullable: true })
  authorId: string;

  @ApiProperty({ description: 'Post author (many-to-one)', type: () => User, required: false })
  @ManyToOne(() => User, (user) => user.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @ApiProperty({ description: 'Comments on the post (one-to-many)', type: () => [Comment], required: false })
  @OneToMany(() => Comment, (comment) => comment.post, { cascade: true })
  comments: Comment[];
}
