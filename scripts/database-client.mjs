import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { X509Certificate } from 'node:crypto';

export async function databaseClient() {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL en .env.local.');
  const url = new URL(process.env.DATABASE_URL);
  // URL options must never override the strict SSL object.
  for (const name of ['sslmode','ssl','sslcert','sslkey','sslrootcert','sslnegotiation','uselibpqcompat']) url.searchParams.delete(name);
  const ca = await readFile(process.env.DATABASE_SSL_CA || 'outputs/supabase-ca.crt', 'utf8');
  const cert = new X509Certificate(ca);
  if (!cert.ca || new Date(cert.validTo) <= new Date()) throw new Error('El certificado CA no es válido.');
  return new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: true, ca }, connectionTimeoutMillis: 20000 });
}
