import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntityWithOrder } from '@ackplus/nest-crud';

/**
 * Extends `BaseEntityWithOrder` (adds an `order` column), so the generated
 * `PUT /tasks/reorder` route can persist a new ordering.
 */
@Entity('tasks')
export class Task extends BaseEntityWithOrder {
  @ApiProperty({ description: 'Task title', example: 'Write e2e tests' })
  @Column()
  title: string;

  @ApiProperty({ description: 'Whether the task is done', example: false, default: false })
  @Column({ default: false })
  done: boolean;
}
