import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Post } from './post.entity';

@Entity('users')
export class User {
  @ApiProperty({ 
    description: 'User ID',
    example: 1
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ 
    description: 'User email address (unique)',
    example: 'john@example.com'
  })
  @Column({ unique: true })
  email: string;

  @ApiProperty({ 
    description: 'User first name',
    example: 'John'
  })
  @Column()
  firstName: string;

  @ApiProperty({ 
    description: 'User last name',
    example: 'Doe'
  })
  @Column()
  lastName: string;

  @ApiProperty({ 
    description: 'User password (hashed)',
    example: 'hashed_password_here'
  })
  @Column()
  password: string;

  @ApiProperty({ 
    description: 'Whether the user account is active',
    example: true,
    default: true
  })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ 
    description: 'User role',
    example: 'user',
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  })
  @Column({ default: 'user' })
  role: string;

  @ApiProperty({ 
    description: 'User posts',
    type: () => [Post],
    required: false
  })
  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];

  @ApiProperty({ 
    description: 'Creation timestamp',
    example: '2024-01-01T00:00:00.000Z'
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ 
    description: 'Last update timestamp',
    example: '2024-01-01T00:00:00.000Z'
  })
  @UpdateDateColumn()
  updatedAt: Date;
}

