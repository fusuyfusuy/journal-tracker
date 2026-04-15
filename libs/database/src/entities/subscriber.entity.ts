import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('subscribers')
export class Subscriber {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text', name: 'channel_type' })
  channel_type!: 'email' | 'webhook';

  @Column({ type: 'text' })
  destination!: string;

  @Column({ type: 'integer', default: 1 })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  created_at!: Date;
}
