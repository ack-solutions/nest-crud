import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Profile } from './profile-test.entity';
import { Country } from './country-test.entity';

@Entity('profile_addresses')
export class ProfileAddress {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: true })
    street: string;

    @Column({ nullable: true })
    street2: string;

    @Column({ nullable: true })
    city: string;

    @Column({ nullable: true })
    state: string;

    @Column({ nullable: true })
    postalCode: string;

    @Column({ type: 'simple-json', nullable: true })
    metadata: Record<string, any>;

    @Column({ default: false })
    isDefault: boolean;

    @ManyToOne(() => Profile, profile => profile.addresses, { onDelete: 'CASCADE' })
    @JoinColumn()
    profile: Profile;

    @ManyToOne(() => Country, country => country.addresses)
    @JoinColumn()
    country: Country;
}
