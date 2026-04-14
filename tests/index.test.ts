import { describe, it, expect } from 'bun:test';
import { parseArgs } from '../src/index';

describe('parseArgs', () => {
  it('returns { once: true } when --once is present', () => {
    expect(parseArgs(['bun', 'src/index.ts', '--once'])).toEqual({ once: true });
  });

  it('returns { once: false } by default', () => {
    expect(parseArgs(['bun', 'src/index.ts'])).toEqual({ once: false });
  });

  it('returns { once: false } when some other flag is present (negative)', () => {
    expect(parseArgs(['bun', 'src/index.ts', '--other'])).toEqual({ once: false });
  });
});
