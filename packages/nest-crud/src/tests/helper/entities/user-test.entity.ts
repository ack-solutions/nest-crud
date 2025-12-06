import { Entity, Column, OneToMany, OneToOne } from 'typeorm';


import { Post } from './post-test.entity';
import { Profile } from './profile-test.entity';
import { BaseEntity } from '../../../lib/base-entity';


@Entity('users')
export class User extends BaseEntity {

    @Column({ nullable: true })
    name: string;

    @Column({ nullable: true })
    email: string;

    @Column({ nullable: true })
    status: string;

    @OneToOne(() => Profile, profile => profile.user, {
        cascade: true,
    })
    profile: Profile;

    @OneToMany(() => Post, post => post.user, {
        cascade: true,
    })
    posts: Post[];

}
