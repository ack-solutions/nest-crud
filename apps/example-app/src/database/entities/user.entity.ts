import { Entity, Column, OneToMany, OneToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity, CrudHidden } from '@ackplus/nest-crud';
import { Post } from './post.entity';
import { Profile } from './profile.entity';
import { AuditLog } from './audit-log.entity';

@Entity('users')
export class User extends BaseEntity {
  @ApiProperty({ description: 'User email address (unique)', example: 'john@example.com' })
  @Column({ unique: true })
  email: string;

  @ApiProperty({ description: 'User first name', example: 'John' })
  @Column()
  firstName: string;

  @ApiProperty({ description: 'User last name', example: 'Doe' })
  @Column()
  lastName: string;

  @ApiProperty({ description: 'Age (handy for $gt / $between / sorting demos)', example: 29 })
  @Column({ type: 'int', nullable: true })
  age: number;

  /**
   * Hidden column: never selectable / filterable / returned. Try
   * `?select=["email","password"]` — `password` is dropped; `?where={"password":...}`
   * → 400.
   */
  @CrudHidden()
  @Column()
  password: string;

  @ApiProperty({ description: 'Whether the user account is active', example: true, default: true })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ description: 'User role', example: 'user', enum: ['user', 'admin', 'moderator'], default: 'user' })
  @Column({ default: 'user' })
  role: string;

  @ApiProperty({ description: 'User profile (one-to-one)', type: () => Profile, required: false })
  @OneToOne(() => Profile, (profile) => profile.user, { cascade: true })
  profile: Profile;

  @ApiProperty({ description: 'User posts (one-to-many)', type: () => [Post], required: false })
  @OneToMany(() => Post, (post) => post.author, { cascade: true })
  posts: Post[];

  /**
   * Hidden relation: cannot be joined or aggregated through the CRUD query surface.
   * Try `?relations=["auditLogs"]` → 400.
   */
  @CrudHidden()
  @OneToMany(() => AuditLog, (log) => log.user, { cascade: true })
  auditLogs: AuditLog[];
}
