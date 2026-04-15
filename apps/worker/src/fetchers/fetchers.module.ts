import { Module } from '@nestjs/common';
import { FETCHER_TOKEN } from '@journal/shared';
import { ArxivFetcher } from './arxiv.fetcher';
import { FetchersService } from './fetchers.service';
import { RssFetcher } from './rss.fetcher';
import { CrossrefFetcher, HtmlFetcher, PubmedFetcher } from './stub.fetchers';

@Module({
  providers: [
    RssFetcher,
    ArxivFetcher,
    CrossrefFetcher,
    PubmedFetcher,
    HtmlFetcher,
    {
      provide: FETCHER_TOKEN,
      useFactory: (
        rss: RssFetcher,
        arxiv: ArxivFetcher,
        cr: CrossrefFetcher,
        pm: PubmedFetcher,
        html: HtmlFetcher,
      ) => [rss, arxiv, cr, pm, html],
      inject: [RssFetcher, ArxivFetcher, CrossrefFetcher, PubmedFetcher, HtmlFetcher],
    },
    FetchersService,
  ],
  exports: [FetchersService],
})
export class FetchersModule {}
