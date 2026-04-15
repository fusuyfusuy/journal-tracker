export interface JournalResult {
  journal_id: number;
  new_articles: number;
  skipped: number;
  errors: number;
}

export interface CycleSummary {
  started_at: string;
  finished_at: string;
  journals_processed: number;
  articles_new: number;
  errors: number;
  journals: JournalResult[];
}
