import { InitialSchema1776247402498 } from './1776247402498-InitialSchema';

/**
 * Single source of truth for TypeORM migrations.
 *
 * After running `bun run migration:generate`, import the new migration class
 * here and add it to the array so both the runtime (DatabaseModule) and the
 * CLI DataSource pick it up.
 */
export const MIGRATIONS = [InitialSchema1776247402498];
