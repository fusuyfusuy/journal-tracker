import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Journal } from './journal.entity';

@Entity('articles')
@Index('idx_articles_dedupe', ['dedupe_key'], { unique: true })
export class Article {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer', name: 'journal_id' })
  journal_id!: number;

  @ManyToOne(() => Journal, (j) => j.articles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'journal_id' })
  journal?: Journal;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  url!: string;

  @Column({ type: 'text', nullable: true })
  doi!: string | null;

  @Column({ type: 'datetime', name: 'published_at' })
  published_at!: Date;

  @Column({ type: 'text', name: 'dedupe_key' })
  dedupe_key!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  created_at!: Date;
}
