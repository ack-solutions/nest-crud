import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ProfileAddress } from './profile-address-test.entity';

@Entity('countries')
export class Country {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: true })
    name: string;

    @Column({ length: 2, unique: true, nullable: true })
    code: string;

    @Column({ nullable: true })
    phoneCode: string;

    @Column({ type: 'simple-json', nullable: true })
    metadata: Record<string, any>;

    @OneToMany(() => ProfileAddress, address => address.country)
    addresses: ProfileAddress[];
}
