import { Entity, Column } from 'typeorm';

import { BaseEntityWithOrder } from '../../../lib/base-entity';

@Entity('ordered_items')
export class OrderedItem extends BaseEntityWithOrder {

    @Column({ nullable: true })
    name: string;

    // A second sortable column, so tests can exercise a configurable `reorderColumn`.
    @Column({ default: 0 })
    sortOrder: number;

}
