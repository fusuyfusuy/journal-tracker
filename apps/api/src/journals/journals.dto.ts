import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateJournalDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(['rss', 'arxiv', 'crossref', 'pubmed', 'html'])
  fetcher_type!: 'rss' | 'arxiv' | 'crossref' | 'pubmed' | 'html';

  @IsString()
  @MinLength(1)
  feed_url!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateJournalDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  feed_url?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
