// Email notifier via Resend REST API (raw fetch — no @resend/node SDK).
// POST https://api.resend.com/emails

import type { Notifier } from './index';
import type { Article, Subscriber } from '../types/index';
import type { NotificationEvent } from '../types/index';
import type { AppConfig } from '../config';

const RESEND_API_URL = 'https://api.resend.com/emails';

export class EmailNotifier implements Notifier {
  async dispatch(article: Article, subscriber: Subscriber, config: AppConfig): Promise<NotificationEvent> {
    const from = config.resendApiKey ? 'notifications@example.com' : 'notifications@example.com';
    const payload = {
      from,
      to: [subscriber.destination],
      subject: article.title,
      html: renderEmailHtml(article),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorBody = await res.text();
        return {
          article_id: article.id,
          subscriber_id: subscriber.id,
          channel: subscriber.channel_type,
          status: 'error',
          error_message: `HTTP ${res.status}: ${errorBody}`,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        article_id: article.id,
        subscriber_id: subscriber.id,
        channel: subscriber.channel_type,
        status: 'ok',
        error_message: null,
        timestamp: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Render a minimal HTML email body for an article notification.
 */
export function renderEmailHtml(article: Article): string {
  const doiSection = article.doi
    ? `<p><strong>DOI:</strong> <a href="https://doi.org/${article.doi}">${article.doi}</a></p>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    h2 { color: #1f2937; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>${article.title}</h2>
    <p><strong>Published:</strong> ${new Date(article.published_at).toLocaleDateString()}</p>
    <p><a href="${article.url}">Read Article</a></p>
    ${doiSection}
    <div class="footer">
      <p>This is an automated notification from Academic Journal Tracker.</p>
    </div>
  </div>
</body>
</html>`;
}
