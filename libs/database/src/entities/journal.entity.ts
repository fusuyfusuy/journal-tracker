import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Article } from './article.entity';

@Entity('journals')
export class Journal {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', name: 'fetcher_type' })
  fetcher_type!: 'rss' | 'arxiv' | 'crossref' | 'pubmed' | 'html';

  @Column({ type: 'text', name: 'feed_url' })
  feed_url!: string;

  @Column({ type: 'integer', default: 1 })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  created_at!: Date;

  @OneToMany(() => Article, (a) => a.journal)
  articles?: Article[];
}
