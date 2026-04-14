import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// seed.ts is a script (it calls seed() at module load). We do not import it
// directly to avoid side effects. Instead we assert its shape from the source.
describe('seed script', () => {
  it('defines a seed() orchestrator and calls insertJournal/insertSubscriber', () => {
    const src = readFileSync(join(__dirname, '..', 'src', 'seed.ts'), 'utf8');
    expect(src).toContain('function seed');
    expect(src).toMatch(/insertJournal|JournalInsert/);
    expect(src).toMatch(/insertSubscriber|SubscriberInsert/);
  });

  it('fails loudly (process.exit(1)) on fatal error — negative case shape', () => {
    const src = readFileSync(join(__dirname, '..', 'src', 'seed.ts'), 'utf8');
    expect(src).toContain('process.exit(1)');
  });
});
