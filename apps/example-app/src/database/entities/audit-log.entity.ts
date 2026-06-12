import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '@ackplus/nest-crud';
import { User } from './user.entity';

/**
 * Sensitive audit trail. On `User` this relation is marked `@CrudHidden()`, so it
 * can never be joined or aggregated through the public CRUD query surface.
 */
@Entity('audit_logs')
export class AuditLog extends BaseEntity {
  @ApiProperty({ description: 'Action performed', example: 'login' })
  @Column()
  action: string;

  @ApiProperty({ description: 'Source IP', example: '203.0.113.7', required: false })
  @Column({ nullable: true })
  ip: string;

  @ApiProperty({ description: 'Owning user id', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => User, (user) => user.auditLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
