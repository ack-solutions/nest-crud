import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';

import { Comment } from './comment-test.entity';
import { User } from './user-test.entity';
import { BaseEntity } from '../../../lib/base-entity';


@Entity('posts')
export class Post extends BaseEntity {

    @Column({ nullable: true })
    title: string;

    @Column('text', { nullable: true })
    content: string;

    @Column({ nullable: true })
    status: string;

    @Column('int', { nullable: true })
    likes: number;

    @Column('simple-array', { nullable: true })
    tags: string[];

    @ManyToOne(() => User, user => user.posts)
    user: User;

    @OneToMany(() => Comment, comment => comment.post, {
        cascade: true,
    })
    comments: Comment[];

}
