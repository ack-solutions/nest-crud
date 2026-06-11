import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '@ackplus/nest-crud';
import { Profile } from './profile.entity';

@Entity('addresses')
export class Address extends BaseEntity {
  @ApiProperty({ description: 'City', example: 'New York' })
  @Column()
  city: string;

  @ApiProperty({ description: 'State / region', example: 'NY', required: false })
  @Column({ nullable: true })
  state: string;

  @ApiProperty({ description: 'Country', example: 'USA' })
  @Column()
  country: string;

  @ApiProperty({ description: 'Postal code', example: '10001', required: false })
  @Column({ nullable: true })
  postalCode: string;

  @ApiProperty({ description: 'Owning profile id', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @Column({ nullable: true })
  profileId: string;

  @ManyToOne(() => Profile, (profile) => profile.addresses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profileId' })
  profile: Profile;
}
