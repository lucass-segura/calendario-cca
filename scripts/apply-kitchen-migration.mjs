// Local-only, checked migration runner. Requires DATABASE_URL in .env.local.
import { databaseClient } from './database-client.mjs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const file = '20261005000000_kitchen_access_and_reports.sql';
const sql = await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8');
const checksum = createHash('sha256').update(sql).digest('hex');
const client = await databaseClient();
try {
  await client.connect();
  await client.query('begin');
  await client.query('select pg_advisory_xact_lock(7340102)');
  await client.query('create table if not exists public.cca_schema_migrations(name text primary key, checksum text not null, applied_at timestamptz not null default now())');
  await client.query('revoke all on public.cca_schema_migrations from public, anon, authenticated');
  const previous = await client.query('select checksum from public.cca_schema_migrations where name=$1', [file]);
  if (previous.rows.length) {
    if (previous.rows[0].checksum !== checksum) throw new Error('La migración ya aplicada cambió. Se necesita una migración nueva.');
    await client.query('rollback'); console.log('La migración de cocina ya estaba aplicada.');
  } else {
    // The file also supports the SQL editor; this runner owns the transaction.
    const body = sql.replace(/^begin;\s*/i, '').replace(/commit;\s*$/i, '');
    await client.query(body);
    await client.query('insert into public.cca_schema_migrations(name,checksum) values ($1,$2)', [file, checksum]);
    await client.query('commit'); console.log('Migración de cocina aplicada en una transacción.');
  }
} catch (error) {
  await client.query('rollback').catch(() => {});
  // Never print the connection string, password or a full database error object.
  console.error(`No se aplicó la migración (${error.code ?? 'error'}). ${error.code ? '' : error.message}`);
  process.exitCode = 1;
} finally { await client.end(); }
