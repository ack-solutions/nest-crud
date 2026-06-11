import { Entity, Column, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '@ackplus/nest-crud';
import { User } from './user.entity';
import { Address } from './address.entity';

/**
 * One-to-one with User, and one-to-many with Address — demonstrates a nested
 * relation path (`profile.addresses`) for selecting / filtering / hydrating.
 */
@Entity('profiles')
export class Profile extends BaseEntity {
  @ApiProperty({ description: 'Short bio', example: 'Full-stack engineer based in NYC' })
  @Column('text', { nullable: true })
  bio: string;

  @ApiProperty({ description: 'Personal website', example: 'https://john.dev', required: false })
  @Column({ nullable: true })
  website: string;

  @ApiProperty({ description: 'Owning user id', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @Column({ nullable: true })
  userId: string;

  @OneToOne(() => User, (user) => user.profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ApiProperty({ description: 'Addresses on this profile', type: () => [Address], required: false })
  @OneToMany(() => Address, (address) => address.profile, { cascade: true })
  addresses: Address[];
}
