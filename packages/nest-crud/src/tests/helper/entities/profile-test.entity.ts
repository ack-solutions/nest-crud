import { Entity, Column, OneToOne, JoinColumn, OneToMany } from 'typeorm';

import { User } from './user-test.entity';
import { BaseEntity } from '../../../lib/base-entity';
import { ProfileAddress } from './profile-address-test.entity';


// Define test entities

@Entity('profiles')
export class Profile extends BaseEntity {

    @Column({ nullable: true })
    age: number;

    @Column({ nullable: true })
    bio: string;

    @Column({ default: false })
    verified: boolean;

    @OneToOne(() => User, user => user.profile)
    @JoinColumn()
    user: User;

    @OneToMany(() => ProfileAddress, address => address.profile, {
        cascade: true
    })
    addresses: ProfileAddress[];

}
