import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from './supabase/server';

/** Returns the request-scoped Supabase client (RLS enforced) or null when nobody is signed in. */
export async function authedClient(): Promise<SupabaseClient | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ? supabase : null;
}

export const unauthorized = () => Response.json({ error: 'Necesitás iniciar sesión.' }, { status: 401 });

const PAGE = 1000;

/** PostgREST caps each response (1000 rows by default); read every page of a query. */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/** The client UI reads JSON columns as strings (as they were stored in SQLite). */
export function reservationOut<T extends { sectors_json?: unknown; repeat_rule?: unknown }>(row: T) {
  return {
    ...row,
    sectors_json: row.sectors_json == null ? null : JSON.stringify(row.sectors_json),
    repeat_rule: row.repeat_rule == null ? null : JSON.stringify(row.repeat_rule),
  };
}

/** Escapes LIKE wildcards so ilike behaves as a case-insensitive equality. */
export const likeLiteral = (value: string) => value.replace(/[\\%_]/g, c => '\\' + c);
