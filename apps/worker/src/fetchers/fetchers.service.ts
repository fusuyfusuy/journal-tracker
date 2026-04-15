import { Inject, Injectable } from '@nestjs/common';
import type { Fetcher, FetcherType } from '@journal/shared';
import { FETCHER_TOKEN } from '@journal/shared';

@Injectable()
export class FetchersService {
  private readonly byType: Map<FetcherType, Fetcher>;

  constructor(@Inject(FETCHER_TOKEN) fetchers: Fetcher[]) {
    this.byType = new Map(fetchers.map((f) => [f.type, f]));
  }

  resolve(type: FetcherType): Fetcher {
    const f = this.byType.get(type);
    if (!f) throw new Error(`no fetcher registered for type "${type}"`);
    return f;
  }
}
