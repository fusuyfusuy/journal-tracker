// cycle.ts — executes one full check cycle, mapping to statechart transitions.
// Corresponds to the check_cycle statechart (idle -> loading_journals -> ... -> cycle_complete).

import type { Database } from 'bun:sqlite';
import type {
  Journal,
  Article,
  NormalizedArticle,
  Subscriber,
} from './types/index';
import type {
  FetchResult,
  NotificationEvent,
  CycleSummary,
  JournalResult,
} from './types/index';
import type { AppConfig } from './config';
import { getActiveJournals, articleExistsByDedupeKey, insertArticle, getActiveSubscribers } from './db';
import { fetchJournalArticles } from './fetchers/index';
import { dispatchNotification } from './notifiers/index';
import { log } from './log';
import { NormalizedArticleSchema } from './types/index';

// ---- Statechart action: loadActiveJournals ----

export async function loadActiveJournals(db: Database): Promise<Journal[]> {
  return getActiveJournals(db);
}

// ---- Statechart action: selectNextJournal ----

export function selectNextJournal(journals: Journal[], index: number): Journal {
  if (index < 0 || index >= journals.length) {
    throw new Error(`selectNextJournal: index ${index} out of range (len=${journals.length})`);
  }
  return journals[index]!;
}

// ---- Statechart action: normalizeArticles ----

export function normalizeArticles(fetchResult: FetchResult): NormalizedArticle[] {
  if (fetchResult.error !== null) {
    return [];
  }

  const validated: NormalizedArticle[] = [];
  for (const article of fetchResult.articles) {
    const result = NormalizedArticleSchema.safeParse(article);
    if (!result.success) {
      log.debug('article.validation_failed', {
        url: article.url,
        errors: result.error.issues,
      });
    } else {
      validated.push(result.data);
    }
  }

  return validated;
}

// ---- Statechart action: dedupeArticle ----

export function dedupeArticle(db: Database, article: NormalizedArticle): boolean {
  const dedupeKey = article.doi ?? article.url;
  return articleExistsByDedupeKey(db, dedupeKey);
}

// ---- Statechart action: skipArticle ----

export function skipArticle(article: NormalizedArticle): void {
  const dedupeKey = article.doi ?? article.url;
  log.debug('article.skip', { dedupe_key: dedupeKey, title: article.title });
}

// ---- Statechart action: persistArticle ----

export async function persistArticle(
  db: Database,
  article: NormalizedArticle,
  journalId: number
): Promise<Article> {
  const dedupeKey = article.doi ?? article.url;
  const articleInsert = {
    journal_id: journalId,
    title: article.title,
    url: article.url,
    doi: article.doi,
    published_at: article.published_at,
    dedupe_key: dedupeKey,
  };
  return insertArticle(db, articleInsert);
}

// ---- Statechart action: nextArticle ----

export function nextArticle(currentIndex: number): number {
  return currentIndex + 1;
}

// ---- Statechart action: loadSubscribers ----

export async function loadSubscribers(db: Database): Promise<Subscriber[]> {
  return getActiveSubscribers(db);
}

// ---- Statechart action: logDeliverOk ----

export function logDeliverOk(event: NotificationEvent): void {
  log.info('notify.ok', {
    article_id: event.article_id,
    subscriber_id: event.subscriber_id,
    channel: event.channel,
  });
}

// ---- Statechart action: logJournalResult ----

export function logJournalResult(result: JournalResult): void {
  log.info('journal.done', {
    journal_id: result.journal_id,
    journal_name: result.journal_name,
    fetched: result.fetched,
    new_articles: result.new_articles,
    errors: result.errors,
  });
}

// ---- Statechart action: logCycleSummary ----

export function logCycleSummary(summary: CycleSummary): void {
  log.info('cycle.done', {
    started_at: summary.started_at,
    finished_at: summary.finished_at,
    journals_processed: summary.journals_processed,
    articles_new: summary.articles_new,
    errors: summary.errors,
  });
}

// ---- Statechart action: handleFetchError ----

export function handleFetchError(error: Error, journalId: number): void {
  log.error('fetch.error', {
    journal_id: journalId,
    message: error.message,
    stack: error.stack,
  });
}

// ---- Statechart action: handleNotifyError ----

export function handleNotifyError(error: Error, subscriberId: number, articleId: number): void {
  log.error('notify.error', {
    subscriber_id: subscriberId,
    article_id: articleId,
    message: error.message,
  });
}

// ---- Statechart action: handleDbError ----

export function handleDbError(error: Error, context: string): void {
  log.error('db.error', {
    context,
    message: error.message,
    stack: error.stack,
  });
}

// ---- Statechart action: handleTimeout ----

export function handleTimeout(context: string): void {
  log.warn('timeout', { context });
}

// ---- Statechart action: logAndContinue ----

export function logAndContinue(context: string, reason?: string): void {
  log.info('error.continue', {
    context,
    reason: reason ?? 'proceeding after recoverable error',
  });
}

// ---- Statechart action: resetCycleState ----

export function resetCycleState(): void {
  log.debug('cycle.reset');
}

// ---- Top-level cycle runner ----

/**
 * Runs one complete check cycle through all active journals.
 * Called by the scheduler on each tick and by the CLI in --once mode.
 */
export async function runCycle(db: Database, config: AppConfig): Promise<CycleSummary> {
  const started_at = new Date().toISOString();
  let articles_new = 0;
  let errors = 0;

  let journals: Journal[];
  try {
    journals = await loadActiveJournals(db);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    handleDbError(error, 'loadActiveJournals');
    const summary: CycleSummary = {
      started_at,
      finished_at: new Date().toISOString(),
      journals_processed: 0,
      articles_new: 0,
      errors: 1,
    };
    logCycleSummary(summary);
    return summary;
  }

  if (journals.length === 0) {
    const summary: CycleSummary = {
      started_at,
      finished_at: new Date().toISOString(),
      journals_processed: 0,
      articles_new: 0,
      errors: 0,
    };
    logCycleSummary(summary);
    return summary;
  }

  for (let journalIndex = 0; journalIndex < journals.length; journalIndex++) {
    const journal = selectNextJournal(journals, journalIndex);

    let fetchResult: FetchResult;
    try {
      fetchResult = await fetchJournalArticles(journal, config);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      handleFetchError(error, journal.id);
      logAndContinue('fetching_journal', 'fetch failed');
      continue;
    }

    const articles = normalizeArticles(fetchResult);
    let journalNew = 0;
    let journalErrors = 0;

    for (let articleIndex = 0; articleIndex < articles.length; articleIndex++) {
      const article = articles[articleIndex];

      const isDupe = dedupeArticle(db, article);
      if (isDupe) {
        skipArticle(article);
        continue;
      }

      let persisted: Article;
      try {
        persisted = await persistArticle(db, article, journal.id);
        journalNew++;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        handleDbError(error, 'persistArticle');
        logAndContinue('persist_article', 'persist failed');
        journalErrors++;
        continue;
      }

      let subscribers: Subscriber[];
      try {
        subscribers = await loadSubscribers(db);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        handleDbError(error, 'loadSubscribers');
        logAndContinue('dispatch_for_article', 'load subscribers failed');
        journalErrors++;
        continue;
      }

      for (let subscriberIndex = 0; subscriberIndex < subscribers.length; subscriberIndex++) {
        const subscriber = subscribers[subscriberIndex];

        try {
          const event = await dispatchNotification(persisted, subscriber, config);
          logDeliverOk(event);
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          handleNotifyError(error, subscriber.id, persisted.id);
          logAndContinue('deliver_notification', 'dispatch failed');
          journalErrors++;
        }
      }
    }

    const journalResult: JournalResult = {
      journal_id: journal.id,
      journal_name: journal.name,
      fetched: articles.length,
      new_articles: journalNew,
      errors: journalErrors,
    };
    logJournalResult(journalResult);

    articles_new += journalNew;
    errors += journalErrors;
  }

  const summary: CycleSummary = {
    started_at,
    finished_at: new Date().toISOString(),
    journals_processed: journals.length,
    articles_new,
    errors,
  };
  logCycleSummary(summary);
  resetCycleState();
  return summary;
}
