import { Entity, Column } from 'typeorm';

import { BaseEntityWithOrder } from '../../../lib/base-entity';

@Entity('ordered_items')
export class OrderedItem extends BaseEntityWithOrder {

    @Column({ nullable: true })
    name: string;

}
