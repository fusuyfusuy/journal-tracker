import { ValueTransformer } from 'typeorm';

/** better-sqlite3 stores booleans as INTEGER 0/1; coerce on read. */
export const BooleanColumn: ValueTransformer = {
  from: (v: number | boolean | null): boolean => v === true || v === 1,
  to: (v: boolean): number => (v ? 1 : 0),
};

/** Ensure Date columns are returned as Date instances (ISO strings on write). */
export const DateColumn: ValueTransformer = {
  from: (v: string | Date | null): Date | null => (v ? new Date(v) : null),
  to: (v: Date | string | null): Date | null => (v instanceof Date ? v : v ? new Date(v) : null),
};
