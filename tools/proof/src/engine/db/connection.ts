import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import * as path from 'node:path';
import { PROOF_SCHEMA_SQL } from './schema.sql.js';
import type { ProofDatabase } from './types.js';

/**
 * The proof app's own database file -- isolated from the product. Never shares a
 * connection, a schema file, or an instance with db/schema.hcl or real user data.
 * Persistent: applying the schema never drops a table, so data survives across runs.
 */
const PROOF_DB_PATH = path.resolve(import.meta.dirname, '../../../journey.db');

export function openProofDb(dbPath: string = PROOF_DB_PATH): Kysely<ProofDatabase> {
  const sqlite = new Database(dbPath);
  sqlite.exec(PROOF_SCHEMA_SQL);
  return new Kysely<ProofDatabase>({ dialect: new SqliteDialect({ database: sqlite }) });
}
