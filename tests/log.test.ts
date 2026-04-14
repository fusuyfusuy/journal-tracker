import { describe, it, expect, mock } from 'bun:test';
import { log } from '../src/log';

describe('log', () => {
  it('writes a JSON line to stdout at info level', () => {
    const writes: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout as any).write = (chunk: any) => {
      writes.push(String(chunk));
      return true;
    };
    try {
      log.info('test.event', { foo: 'bar' });
    } finally {
      (process.stdout as any).write = orig;
    }
    expect(writes.length).toBeGreaterThan(0);
    const line = writes.join('');
    const parsed = JSON.parse(line.trim());
    expect(parsed.level).toBe('info');
    expect(parsed.msg).toBe('test.event');
    expect(parsed.foo).toBe('bar');
    expect(typeof parsed.ts).toBe('string');
  });

  it('emits debug/warn/error levels respectively', () => {
    const writes: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout as any).write = (chunk: any) => {
      writes.push(String(chunk));
      return true;
    };
    try {
      log.debug('d');
      log.warn('w');
      log.error('e');
    } finally {
      (process.stdout as any).write = orig;
    }
    const levels = writes.map((w) => JSON.parse(w.trim()).level);
    expect(levels).toEqual(['debug', 'warn', 'error']);
  });

  it('does not throw when fields is undefined (negative-ish case)', () => {
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout as any).write = () => true;
    try {
      expect(() => log.info('no-fields')).not.toThrow();
    } finally {
      (process.stdout as any).write = orig;
    }
  });
});
